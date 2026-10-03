package za.co.crimespot.routing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import za.co.crimespot.common.BadRequestException;
import za.co.crimespot.hotspot.CrimeHotspot;
import za.co.crimespot.hotspot.HotspotDetector;
import za.co.crimespot.hotspot.HotspotService;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.ZoneId;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Safe routes: a fastest route and, where possible, a safer one that spends less distance in hotspots.
 *
 * With an OpenRouteService key, the safer route is planned with active hotspots as areas to avoid.
 * Without one, the public OSRM servers (routing.openstreetmap.de) provide alternatives, plus detours via
 * points beside the worst hotspot on the fastest route; the least-exposed candidate wins.
 *
 * Exposure = metres inside each hotspot × that hotspot's risk at the departure time (peak hours and days).
 */
@Service
public class RouteService {

    public record Point(double lat, double lng) {}
    public record Option(String kind, double distanceM, double durationS, List<double[]> path,
                         int exposureScore, double metresInHotspots, List<String> hotspotsPassed) {}
    public record Plan(List<Option> routes, String provider) {}

    private record Raw(double distance, double duration, List<double[]> path) {}

    private static final Logger log = LoggerFactory.getLogger(RouteService.class);
    private static final ZoneId SAST = ZoneId.of("Africa/Johannesburg");
    private static final String UA = "CrimeSpot/1.0 (+https://crimespot-web.onrender.com; kutlwanomokubetsi@gmail.com)";

    private final HotspotService hotspots;
    private final ObjectMapper json;
    private final String orsKey;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final ReentrantLock throttle = new ReentrantLock();
    private volatile long lastCall;
    private final Map<String, Plan> cache = new ConcurrentHashMap<>();
    private final Map<String, Long> cacheTime = new ConcurrentHashMap<>();

    public RouteService(HotspotService hotspots, ObjectMapper json, @Value("${app.routing.ors-key:}") String orsKey) {
        this.hotspots = hotspots;
        this.json = json;
        this.orsKey = orsKey;
    }

    public Plan plan(Point from, Point to, boolean walk) { return plan(from, to, walk, null); }

    public Plan plan(Point from, Point to, boolean walk, java.time.Instant departAt) {
        java.time.ZonedDateTime when = (departAt == null ? java.time.Instant.now() : departAt).atZone(SAST);
        validate(from, to, walk);
        String key = String.format(Locale.ROOT, "%.4f,%.4f|%.4f,%.4f|%s|%d", from.lat(), from.lng(), to.lat(), to.lng(), walk, when.getHour());
        Long t = cacheTime.get(key);
        if (t != null && System.currentTimeMillis() - t < 10 * 60_000) return cache.get(key);

        List<CrimeHotspot> spots = hotspots.active();
        List<Raw> candidates = new ArrayList<>();
        String provider;

        if (!orsKey.isBlank()) {
            provider = "openrouteservice";
            ors(from, to, walk, null).ifPresent(candidates::add);
            List<CrimeHotspot> avoid = spots.stream()
                    .filter(h -> h.getIntensityScore() >= 0.25 && !inside(h, from) && !inside(h, to)).toList();
            if (!avoid.isEmpty()) ors(from, to, walk, avoid).ifPresent(candidates::add);
        } else {
            provider = "osrm";
            candidates.addAll(osrm(List.of(from, to), walk, true));
            // Detour candidates: go around the most exposed hotspot on the quickest route, on either side.
            Optional<Raw> quickest = candidates.stream().min(Comparator.comparingDouble(Raw::duration));
            if (quickest.isPresent()) {
                worstHotspot(quickest.get(), spots, from, to).ifPresent(h -> {
                    for (Point via : besides(h, from, to)) {
                        osrm(List.of(from, via, to), walk, false).stream().findFirst().ifPresent(candidates::add);
                    }
                });
            }
        }
        if (candidates.isEmpty()) throw new BadRequestException("No route found between those points. Try a nearby street.");

        List<Option> scored = candidates.stream().map(c -> score("", c, spots, when)).toList();
        Option fastest = scored.stream().min(Comparator.comparingDouble(Option::durationS)).orElseThrow();
        // Safer: least exposure, but not absurdly longer (at most 1.6× the fastest time).
        Option safer = scored.stream()
                .filter(o -> o.durationS() <= fastest.durationS() * 1.6)
                .min(Comparator.comparingDouble(Option::exposureScore).thenComparingDouble(Option::durationS)).orElse(fastest);

        List<Option> routes = new ArrayList<>();
        if (safer != fastest && safer.exposureScore() < fastest.exposureScore()) {
            routes.add(withKind("SAFER", safer));
            routes.add(withKind("FASTEST", fastest));
        } else {
            routes.add(withKind(fastest.exposureScore() == 0 ? "SAFE_AND_FAST" : "FASTEST", fastest));
        }
        Plan plan = new Plan(routes, provider);
        if (cache.size() > 500) { cache.clear(); cacheTime.clear(); }
        cache.put(key, plan);
        cacheTime.put(key, System.currentTimeMillis());
        return plan;
    }

    // ---------- providers ----------

    private List<Raw> osrm(List<Point> pts, boolean walk, boolean alternatives) {
        StringBuilder coords = new StringBuilder();
        for (Point p : pts) coords.append(coords.isEmpty() ? "" : ";").append(String.format(Locale.ROOT, "%.6f,%.6f", p.lng(), p.lat()));
        String url = "https://routing.openstreetmap.de/" + (walk ? "routed-foot" : "routed-car") + "/route/v1/driving/" + coords
                + "?overview=full&geometries=geojson" + (alternatives ? "&alternatives=3" : "");
        List<Raw> out = new ArrayList<>();
        try {
            JsonNode root = json.readTree(call(HttpRequest.newBuilder(URI.create(url)).GET()));
            for (JsonNode r : root.path("routes")) out.add(new Raw(r.path("distance").asDouble(), r.path("duration").asDouble(), coordinates(r.path("geometry").path("coordinates"))));
        } catch (Exception e) {
            log.debug("OSRM failed: {}", e.getMessage());
        }
        return out;
    }

    private Optional<Raw> ors(Point from, Point to, boolean walk, List<CrimeHotspot> avoid) {
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("coordinates", List.of(List.of(from.lng(), from.lat()), List.of(to.lng(), to.lat())));
            if (avoid != null) {
                List<Object> polys = new ArrayList<>();
                for (CrimeHotspot h : avoid) polys.add(List.of(circle(h.getCenterLatitude(), h.getCenterLongitude(), h.getRadiusMeters())));
                body.put("options", Map.of("avoid_polygons", Map.of("type", "MultiPolygon", "coordinates", polys)));
            }
            String url = "https://api.openrouteservice.org/v2/directions/" + (walk ? "foot-walking" : "driving-car") + "/geojson";
            JsonNode f = json.readTree(call(HttpRequest.newBuilder(URI.create(url))
                    .header("Authorization", orsKey).header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))))).path("features").path(0);
            if (f.isMissingNode()) return Optional.empty();
            JsonNode sum = f.path("properties").path("summary");
            return Optional.of(new Raw(sum.path("distance").asDouble(), sum.path("duration").asDouble(), coordinates(f.path("geometry").path("coordinates"))));
        } catch (Exception e) {
            log.debug("ORS failed: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /** One request at a time, at most one per second (public servers' fair-use expectation). */
    private String call(HttpRequest.Builder req) throws Exception {
        if (!throttle.tryLock(8, TimeUnit.SECONDS)) throw new IllegalStateException("Routing busy");
        try {
            long wait = lastCall + 1_000 - System.currentTimeMillis();
            if (wait > 0) Thread.sleep(wait);
            lastCall = System.currentTimeMillis();
            HttpResponse<String> res = http.send(req.timeout(Duration.ofSeconds(10)).header("User-Agent", UA).build(), HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() != 200) throw new IllegalStateException("HTTP " + res.statusCode());
            return res.body();
        } finally {
            throttle.unlock();
        }
    }

    // ---------- scoring ----------

    private Option score(String kind, Raw r, List<CrimeHotspot> spots, java.time.ZonedDateTime when) {
        double exposure = 0, inside = 0;
        Set<String> passed = new LinkedHashSet<>();
        List<double[]> p = r.path();
        for (int i = 1; i < p.size(); i++) {
            double seg = HotspotDetector.distanceMeters(p.get(i - 1)[0], p.get(i - 1)[1], p.get(i)[0], p.get(i)[1]);
            int steps = Math.max(1, (int) Math.ceil(seg / 20));
            for (int s = 0; s < steps; s++) {
                double f = (s + 0.5) / steps;
                double lat = p.get(i - 1)[0] + (p.get(i)[0] - p.get(i - 1)[0]) * f;
                double lng = p.get(i - 1)[1] + (p.get(i)[1] - p.get(i - 1)[1]) * f;
                for (CrimeHotspot h : spots) {
                    if (HotspotDetector.distanceMeters(lat, lng, h.getCenterLatitude(), h.getCenterLongitude()) <= h.getRadiusMeters()) {
                        double w = HotspotDetector.riskAt(h.getIntensityScore(), h.getPeakHours(), h.getPeakDays(), when);
                        exposure += w * seg / steps;
                        inside += seg / steps;
                        passed.add(h.getName());
                    }
                }
            }
        }
        return new Option(kind, Math.round(r.distance()), Math.round(r.duration()), simplify(p), (int) Math.round(exposure),
                Math.round(inside), List.copyOf(passed));
    }

    private Optional<CrimeHotspot> worstHotspot(Raw r, List<CrimeHotspot> spots, Point from, Point to) {
        Map<CrimeHotspot, Double> hits = new HashMap<>();
        for (double[] p : r.path()) for (CrimeHotspot h : spots) {
            if (inside(h, from) || inside(h, to)) continue; // can't route around a hotspot you start or end in
            if (HotspotDetector.distanceMeters(p[0], p[1], h.getCenterLatitude(), h.getCenterLongitude()) <= h.getRadiusMeters()) {
                hits.merge(h, h.getIntensityScore(), Double::sum);
            }
        }
        return hits.entrySet().stream().max(Map.Entry.comparingByValue()).map(Map.Entry::getKey);
    }

    /** Two via-points just outside the hotspot, either side of the line from start to end. */
    private static List<Point> besides(CrimeHotspot h, Point from, Point to) {
        double cLat = h.getCenterLatitude(), cLng = h.getCenterLongitude();
        double mPerLng = 111_320 * Math.cos(Math.toRadians(cLat));
        double dx = (to.lng() - from.lng()) * mPerLng, dy = (to.lat() - from.lat()) * 111_320;
        double len = Math.max(1, Math.hypot(dx, dy));
        double px = -dy / len, py = dx / len; // perpendicular unit vector
        double off = h.getRadiusMeters() * 1.5 + 100;
        return List.of(new Point(cLat + py * off / 111_320, cLng + px * off / mPerLng),
                       new Point(cLat - py * off / 111_320, cLng - px * off / mPerLng));
    }

    private static boolean inside(CrimeHotspot h, Point p) {
        return HotspotDetector.distanceMeters(p.lat(), p.lng(), h.getCenterLatitude(), h.getCenterLongitude()) <= h.getRadiusMeters();
    }

    private static List<List<Double>> circle(double lat, double lng, double radius) {
        List<List<Double>> ring = new ArrayList<>();
        double mPerLng = 111_320 * Math.cos(Math.toRadians(lat));
        for (int i = 0; i <= 16; i++) {
            double a = 2 * Math.PI * (i % 16) / 16;
            ring.add(List.of(lng + Math.cos(a) * radius / mPerLng, lat + Math.sin(a) * radius / 111_320));
        }
        return ring;
    }

    private static List<double[]> coordinates(JsonNode coords) {
        List<double[]> out = new ArrayList<>();
        for (JsonNode c : coords) out.add(new double[] { c.get(1).asDouble(), c.get(0).asDouble() }); // GeoJSON is [lng, lat]
        return out;
    }

    /** Keep every point at least ~10 m apart: smaller responses for the phone. */
    private static List<double[]> simplify(List<double[]> p) {
        List<double[]> out = new ArrayList<>();
        for (double[] c : p) {
            if (out.isEmpty() || HotspotDetector.distanceMeters(out.get(out.size() - 1)[0], out.get(out.size() - 1)[1], c[0], c[1]) >= 10) {
                out.add(new double[] { Math.round(c[0] * 1e5) / 1e5, Math.round(c[1] * 1e5) / 1e5 });
            }
        }
        double[] last = p.isEmpty() ? null : p.get(p.size() - 1);
        if (last != null && HotspotDetector.distanceMeters(out.get(out.size() - 1)[0], out.get(out.size() - 1)[1], last[0], last[1]) > 1) {
            out.add(new double[] { Math.round(last[0] * 1e5) / 1e5, Math.round(last[1] * 1e5) / 1e5 });
        }
        return out;
    }

    private static Option withKind(String kind, Option o) {
        return new Option(kind, o.distanceM(), o.durationS(), o.path(), o.exposureScore(), o.metresInHotspots(), o.hotspotsPassed());
    }

    private static void validate(Point a, Point b, boolean walk) {
        for (Point p : List.of(a, b)) {
            if (p.lat() < -35.5 || p.lat() > -21.5 || p.lng() < 16 || p.lng() > 33.5) {
                throw new BadRequestException("Routes are available within South Africa only.");
            }
        }
        double d = HotspotDetector.distanceMeters(a.lat(), a.lng(), b.lat(), b.lng());
        if (d < 50) throw new BadRequestException("Start and destination are too close together.");
        if (walk && d > 25_000) throw new BadRequestException("That's too far to walk. Try driving.");
        if (!walk && d > 300_000) throw new BadRequestException("Choose a destination within 300 km.");
    }
}
