package za.co.crimespot.news;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Local crime headlines for the user's area.
 *  1. Area name: OpenStreetMap Nominatim reverse geocoding, from a position rounded to ~5 km (cached 7 days).
 *  2. Headlines: GDELT DOC 2.0 API (free, no key), falling back to Google News RSS (cached 30 minutes per area).
 * Both upstreams are throttled to their published limits; only headline, source and link are kept.
 */
@Service
public class NewsService {

    public record Item(String title, String url, String source, Instant publishedAt) {}
    public record News(String area, List<Item> items) {}

    private static final Logger log = LoggerFactory.getLogger(NewsService.class);
    private static final String UA = "CrimeSpot/1.0 (+https://crimespot-web.onrender.com; kutlwanomokubetsi@gmail.com)";
    private static final double GRID = 0.05; // ~5 km
    private static final long AREA_TTL = Duration.ofDays(7).toMillis();
    private static final long NEWS_TTL = Duration.ofMinutes(30).toMillis();
    private static final int MAX_ITEMS = 10;
    private static final String TERMS = "(crime OR robbery OR hijacking OR shooting OR murder OR theft OR police)";
    private static final DateTimeFormatter GDELT_TIME = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC);

    private record Cached<T>(T value, long expiresAt) {}

    private final Map<String, Cached<String>> areas = new ConcurrentHashMap<>();
    private final Map<String, Cached<List<Item>>> news = new ConcurrentHashMap<>();
    private final Map<String, Long> requestedAreas = new ConcurrentHashMap<>();
    private final Map<String, Cached<Optional<Place>>> places = new ConcurrentHashMap<>();

    /** A geocoded place and how precise it is (half the diagonal of its bounding box). */
    public record Place(double lat, double lng, int precisionMeters) {}
    public record PlaceResult(String name, String detail, double lat, double lng) {}
    private final Map<String, Cached<List<PlaceResult>>> searches = new ConcurrentHashMap<>();

    /** Address and place search within South Africa for the safe-route destination box. */
    public List<PlaceResult> search(String q) {
        String key = q.trim().toLowerCase(Locale.ROOT);
        if (key.length() < 3) return List.of();
        Cached<List<PlaceResult>> c = searches.get(key);
        if (c != null && c.expiresAt() > System.currentTimeMillis()) return c.value();
        if (!throttle(nominatimLock, () -> lastNominatim, 1_100, 4)) return c != null ? c.value() : List.of();
        List<PlaceResult> out = new ArrayList<>();
        try {
            lastNominatim = System.currentTimeMillis();
            JsonNode arr = json.readTree(get("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=za&accept-language=en&q="
                    + URLEncoder.encode(q.trim(), StandardCharsets.UTF_8)));
            for (JsonNode r : arr) {
                String full = r.path("display_name").asText();
                int comma = full.indexOf(',');
                String name = r.hasNonNull("name") && !r.get("name").asText().isBlank() ? r.get("name").asText() : (comma > 0 ? full.substring(0, comma) : full);
                String detail = comma > 0 ? full.substring(comma + 1).trim() : "";
                if (detail.length() > 80) detail = detail.substring(0, 80) + "…";
                out.add(new PlaceResult(name, detail, r.path("lat").asDouble(), r.path("lon").asDouble()));
            }
        } catch (Exception e) {
            log.debug("Place search failed: {}", e.getMessage());
        } finally {
            nominatimLock.unlock();
        }
        bound(searches);
        searches.put(key, new Cached<>(out, System.currentTimeMillis() + 86_400_000L));
        return out;
    }
    private final ReentrantLock nominatimLock = new ReentrantLock(), gdeltLock = new ReentrantLock(), googleLock = new ReentrantLock();
    private volatile long lastNominatim, lastGdelt, lastGoogle;

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NORMAL).build();
    private final ObjectMapper json;

    public NewsService(ObjectMapper json) { this.json = json; }

    public News forLocation(Double lat, Double lng) {
        String area = (lat == null || lng == null) ? "Johannesburg" : areaName(lat, lng);
        requestedAreas.put(area, System.currentTimeMillis());
        return new News(area, headlines(area));
    }

    /** Areas people looked at in the last {@code hours}, most recent first. */
    public List<String> recentAreas(int hours, int max) {
        long since = System.currentTimeMillis() - hours * 3_600_000L;
        return requestedAreas.entrySet().stream().filter(e -> e.getValue() >= since)
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed()).limit(max).map(Map.Entry::getKey).toList();
    }

    public List<Item> headlinesFor(String area) { return headlines(area); }

    /**
     * Forward geocoding within South Africa (Nominatim, same 1 request/second limit, results cached 7 days).
     * Returns empty for anything not found, or too vague to place on a map (bigger than ~6 km across).
     */
    public Optional<Place> geocode(String place, String area) {
        String key = (place + "|" + area).toLowerCase(Locale.ROOT);
        Cached<Optional<Place>> c = places.get(key);
        if (c != null && c.expiresAt() > System.currentTimeMillis()) return c.value();
        Optional<Place> result = Optional.empty();
        if (throttle(nominatimLock, () -> lastNominatim, 1_100, 5)) {
            try {
                lastNominatim = System.currentTimeMillis();
                JsonNode arr = json.readTree(get("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=za&accept-language=en&q="
                        + URLEncoder.encode(place + ", " + area, StandardCharsets.UTF_8)));
                if (arr.isArray() && !arr.isEmpty()) {
                    JsonNode r = arr.get(0), bb = r.path("boundingbox");
                    double s = bb.get(0).asDouble(), n = bb.get(1).asDouble(), w = bb.get(2).asDouble(), e = bb.get(3).asDouble();
                    double diag = za.co.crimespot.hotspot.HotspotDetector.distanceMeters(s, w, n, e);
                    if (diag <= 6_000) {
                        result = Optional.of(new Place(r.path("lat").asDouble(), r.path("lon").asDouble(),
                                (int) Math.max(100, Math.min(3_000, diag / 2))));
                    }
                }
            } catch (Exception ex) {
                log.debug("Geocoding failed: {}", ex.getMessage());
                nominatimLock.unlock();
                return Optional.empty(); // don't cache transient failures
            }
            nominatimLock.unlock();
        } else {
            return Optional.empty();
        }
        bound(places);
        places.put(key, new Cached<>(result, System.currentTimeMillis() + AREA_TTL));
        return result;
    }

    // ---------- area ----------

    private String areaName(double lat, double lng) {
        double rLat = Math.round(lat / GRID) * GRID, rLng = Math.round(lng / GRID) * GRID;
        String key = String.format(Locale.ROOT, "%.2f,%.2f", rLat, rLng);
        Cached<String> c = areas.get(key);
        if (c != null && c.expiresAt() > System.currentTimeMillis()) return c.value();

        String name = null;
        // Nominatim policy: at most 1 request per second, identify the app, cache results.
        if (throttle(nominatimLock, () -> lastNominatim, 1_100, 3)) {
            try {
                lastNominatim = System.currentTimeMillis();
                JsonNode a = json.readTree(get("https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=en"
                        + "&lat=" + rLat + "&lon=" + rLng)).path("address");
                for (String f : List.of("city", "town", "village", "municipality", "county", "state")) {
                    if (a.hasNonNull(f) && !a.get(f).asText().isBlank()) { name = a.get(f).asText(); break; }
                }
            } catch (Exception e) {
                log.debug("Reverse geocoding failed: {}", e.getMessage());
            } finally {
                nominatimLock.unlock();
            }
        }
        if (name == null) return c != null ? c.value() : "South Africa";
        bound(areas);
        areas.put(key, new Cached<>(name, System.currentTimeMillis() + AREA_TTL));
        return name;
    }

    // ---------- headlines ----------

    private List<Item> headlines(String area) {
        Cached<List<Item>> c = news.get(area);
        if (c != null && c.expiresAt() > System.currentTimeMillis()) return c.value();

        List<Item> items = fromGdelt(area);
        if (items.isEmpty()) items = fromGoogleNews(area);
        if (items.isEmpty() && c != null) return c.value(); // keep stale results rather than show nothing

        bound(news);
        news.put(area, new Cached<>(items, System.currentTimeMillis() + (items.isEmpty() ? NEWS_TTL / 3 : NEWS_TTL)));
        return items;
    }

    private List<Item> fromGdelt(String area) {
        // GDELT asks for at most one request every 5 seconds.
        if (!throttle(gdeltLock, () -> lastGdelt, 5_500, 0)) return List.of();
        try {
            lastGdelt = System.currentTimeMillis();
            String q = "\"" + area.replace("\"", "") + "\" " + TERMS + " sourcecountry:sf sourcelang:english";
            String body = get("https://api.gdeltproject.org/api/v2/doc/doc?mode=ArtList&format=json&maxrecords=30&timespan=7d&sort=DateDesc&query="
                    + URLEncoder.encode(q, StandardCharsets.UTF_8));
            if (!body.trim().startsWith("{")) return List.of(); // GDELT returns plain-text errors
            List<Item> out = new ArrayList<>();
            for (JsonNode a : json.readTree(body).path("articles")) {
                Instant at = null;
                try { at = Instant.from(GDELT_TIME.parse(a.path("seendate").asText())); } catch (Exception ignored) { }
                add(out, a.path("title").asText(), a.path("url").asText(), a.path("domain").asText(), at);
            }
            return finish(out);
        } catch (Exception e) {
            log.debug("GDELT failed: {}", e.getMessage());
            return List.of();
        } finally {
            gdeltLock.unlock();
        }
    }

    private List<Item> fromGoogleNews(String area) {
        if (!throttle(googleLock, () -> lastGoogle, 2_000, 0)) return List.of();
        try {
            lastGoogle = System.currentTimeMillis();
            String q = "\"" + area.replace("\"", "") + "\" crime OR robbery OR hijacking OR shooting when:7d";
            String body = get("https://news.google.com/rss/search?hl=en-ZA&gl=ZA&ceid=ZA:en&q=" + URLEncoder.encode(q, StandardCharsets.UTF_8));

            DocumentBuilderFactory f = DocumentBuilderFactory.newInstance();
            // Untrusted XML: block DTDs and external entities (XXE).
            f.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            f.setXIncludeAware(false);
            f.setExpandEntityReferences(false);
            Document doc = f.newDocumentBuilder().parse(new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8)));

            List<Item> out = new ArrayList<>();
            NodeList list = doc.getElementsByTagName("item");
            for (int i = 0; i < list.getLength(); i++) {
                Element it = (Element) list.item(i);
                String source = text(it, "source");
                String title = text(it, "title");
                // Google appends " - Source" to titles.
                if (source != null && title != null && title.endsWith(" - " + source)) title = title.substring(0, title.length() - source.length() - 3);
                Instant at = null;
                try { at = ZonedDateTime.parse(text(it, "pubDate"), DateTimeFormatter.RFC_1123_DATE_TIME).toInstant(); } catch (Exception ignored) { }
                add(out, title, text(it, "link"), source, at);
            }
            return finish(out);
        } catch (Exception e) {
            log.debug("Google News failed: {}", e.getMessage());
            return List.of();
        } finally {
            googleLock.unlock();
        }
    }

    // ---------- helpers ----------

    /** Only plain web links, never javascript: or data: URLs. */
    private static void add(List<Item> out, String title, String url, String source, Instant at) {
        if (title == null || title.isBlank() || url == null) return;
        if (!(url.startsWith("https://") || url.startsWith("http://"))) return;
        out.add(new Item(title.trim(), url, source == null || source.isBlank() ? hostOf(url) : source.trim(), at));
    }

    private static List<Item> finish(List<Item> items) {
        Set<String> seen = new HashSet<>();
        return items.stream()
                .filter(i -> seen.add(i.title().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "")))
                .sorted(Comparator.comparing(Item::publishedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(MAX_ITEMS).toList();
    }

    private String get(String url) throws Exception {
        HttpRequest req = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(8))
                .header("User-Agent", UA).header("Accept", "application/json, application/rss+xml, */*").GET().build();
        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() != 200) throw new IllegalStateException("HTTP " + res.statusCode());
        return res.body();
    }

    /** Takes the lock and waits out the minimum gap. Returns false (lock not held) if busy. */
    private static boolean throttle(ReentrantLock lock, java.util.function.LongSupplier last, long gapMs, int waitSeconds) {
        try {
            if (!lock.tryLock(waitSeconds, TimeUnit.SECONDS)) return false;
            long wait = last.getAsLong() + gapMs - System.currentTimeMillis();
            if (wait > 0) {
                if (wait > 2_000) { lock.unlock(); return false; } // don't make users wait; use the fallback or cache
                Thread.sleep(wait);
            }
            return true;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    private static String text(Element e, String tag) {
        NodeList n = e.getElementsByTagName(tag);
        return n.getLength() == 0 ? null : n.item(0).getTextContent();
    }

    private static String hostOf(String url) {
        try { return URI.create(url).getHost().replaceFirst("^www\\.", ""); } catch (Exception e) { return ""; }
    }

    private static void bound(Map<String, ?> m) {
        if (m.size() > 500) m.clear(); // simple memory cap; entries are cheap to rebuild
    }
}
