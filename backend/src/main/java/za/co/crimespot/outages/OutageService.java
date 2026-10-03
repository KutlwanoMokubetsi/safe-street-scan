package za.co.crimespot.outages;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import za.co.crimespot.common.BadRequestException;
import za.co.crimespot.common.ReadCache;
import za.co.crimespot.hotspot.CrimeHotspot;
import za.co.crimespot.hotspot.HotspotDetector;
import za.co.crimespot.hotspot.HotspotService;
import za.co.crimespot.i18n.Messages;
import za.co.crimespot.push.NotificationService;
import za.co.crimespot.realtime.RealtimeHub;
import za.co.crimespot.user.User;
import za.co.crimespot.user.UserRepository;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Community-reported power outages. An outage zone needs 3 different people within ~1 km in the last 6 hours.
 * Zones overlapping a crime hotspot warn people whose home is within their alert distance (once per zone).
 */
@Service
public class OutageService {

    public record Zone(double lat, double lng, int radiusM, int reports, Instant since, String hotspot) {}
    public record Overview(List<Zone> zones, boolean mineOpen) {}

    private static final double GRID = 0.002;     // ~200 m rounding of reported positions
    private static final double JOIN_M = 1_000;    // reports within 1 km form one zone
    private static final int MIN_REPORTS = 3;
    private static final Duration WINDOW = Duration.ofHours(6);

    private final JdbcTemplate jdbc;
    private final HotspotService hotspots;
    private final UserRepository users;
    private final NotificationService notifications;
    private final RealtimeHub hub;
    private final ReadCache cache;
    private final Map<String, Instant> notified = new ConcurrentHashMap<>();

    public OutageService(JdbcTemplate jdbc, HotspotService hotspots, UserRepository users, NotificationService notifications,
                         RealtimeHub hub, ReadCache cache) {
        this.jdbc = jdbc;
        this.hotspots = hotspots;
        this.users = users;
        this.notifications = notifications;
        this.hub = hub;
        this.cache = cache;
    }

    @Transactional
    public void reportOut(UUID me, double lat, double lng) {
        if (lat < -35.5 || lat > -21.5 || lng < 16 || lng > 33.5) throw new BadRequestException("Outages can be reported in South Africa only.");
        jdbc.update("UPDATE outage_reports SET restored_at = now() WHERE user_id = ? AND restored_at IS NULL", me);
        jdbc.update("INSERT INTO outage_reports (user_id, latitude, longitude) VALUES (?, ?, ?)", me,
                Math.round(lat / GRID) * GRID, Math.round(lng / GRID) * GRID);
        hub.toAll("outages");
    }

    @Transactional
    public void reportRestored(UUID me) {
        jdbc.update("UPDATE outage_reports SET restored_at = now() WHERE user_id = ? AND restored_at IS NULL", me);
        hub.toAll("outages");
    }

    public Overview overview(UUID me) {
        Integer mine = jdbc.queryForObject("SELECT count(*) FROM outage_reports WHERE user_id = ? AND restored_at IS NULL AND created_at > ?",
                Integer.class, me, java.sql.Timestamp.from(Instant.now().minus(WINDOW)));
        return new Overview(cache.get("outage-zones", "outages", this::zones), mine != null && mine > 0);
    }

    private record Pt(UUID user, double lat, double lng, Instant at) {}

    /** Greedy clustering: few points, so simple is fine. Each zone counts distinct people, not reports. */
    List<Zone> zones() {
        List<Pt> pts = jdbc.query("SELECT user_id, latitude, longitude, created_at FROM outage_reports WHERE restored_at IS NULL AND created_at > ?",
                (rs, i) -> new Pt((UUID) rs.getObject(1), rs.getDouble(2), rs.getDouble(3), rs.getTimestamp(4).toInstant()),
                java.sql.Timestamp.from(Instant.now().minus(WINDOW)));
        List<CrimeHotspot> spots = hotspots.active();
        boolean[] used = new boolean[pts.size()];
        List<Zone> out = new ArrayList<>();
        for (int i = 0; i < pts.size(); i++) {
            if (used[i]) continue;
            List<Pt> group = new ArrayList<>();
            for (int j = i; j < pts.size(); j++) {
                if (!used[j] && HotspotDetector.distanceMeters(pts.get(i).lat(), pts.get(i).lng(), pts.get(j).lat(), pts.get(j).lng()) <= JOIN_M) {
                    used[j] = true;
                    group.add(pts.get(j));
                }
            }
            long people = group.stream().map(Pt::user).distinct().count();
            if (people < MIN_REPORTS) continue;
            double lat = group.stream().mapToDouble(Pt::lat).average().orElseThrow();
            double lng = group.stream().mapToDouble(Pt::lng).average().orElseThrow();
            double far = group.stream().mapToDouble(p -> HotspotDetector.distanceMeters(lat, lng, p.lat(), p.lng())).max().orElse(0);
            int radius = (int) Math.max(400, Math.min(2_000, far + 200));
            Instant since = group.stream().map(Pt::at).min(Comparator.naturalOrder()).orElseThrow();
            String hotspot = spots.stream()
                    .filter(h -> HotspotDetector.distanceMeters(lat, lng, h.getCenterLatitude(), h.getCenterLongitude()) <= radius + h.getRadiusMeters())
                    .map(CrimeHotspot::getName).findFirst().orElse(null);
            out.add(new Zone(Math.round(lat * 1e4) / 1e4, Math.round(lng * 1e4) / 1e4, radius, (int) people, since, hotspot));
        }
        return out;
    }

    /** Warn people living near outage zones that overlap a hotspot. Each zone is announced once. */
    @Scheduled(initialDelay = 60_000, fixedDelay = 120_000)
    public void warn() {
        cache.invalidate("outages");
        notified.values().removeIf(t -> t.isBefore(Instant.now().minus(Duration.ofHours(12))));
        for (Zone z : zones()) {
            if (z.hotspot() == null) continue;
            String key = String.format(Locale.ROOT, "%.2f,%.2f@%d", z.lat(), z.lng(), z.since().getEpochSecond() / 3600);
            if (notified.putIfAbsent(key, Instant.now()) != null) continue;
            List<UUID> nearby = new ArrayList<>();
            for (User u : users.findByAlertRadiusMGreaterThan(0)) {
                if (u.getHomeLat() == null) continue;
                if (HotspotDetector.distanceMeters(u.getHomeLat(), u.getHomeLng(), z.lat(), z.lng()) <= u.getAlertRadiusM() + z.radiusM()) nearby.add(u.getId());
            }
            Map<String, Object> p = Map.of("place", z.hotspot(), "n", z.reports());
            notifications.sendLocalized(nearby, l -> new String[] {
                    Messages.t(l, "push.outage.title", p), Messages.t(l, "push.outage.body", p) + " " + Messages.t(l, "push.outage.hotspot") },
                    "/map?lat=" + z.lat() + "&lng=" + z.lng(), false);
        }
    }
}
