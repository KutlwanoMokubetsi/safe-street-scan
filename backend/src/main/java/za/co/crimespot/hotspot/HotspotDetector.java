package za.co.crimespot.hotspot;

import za.co.crimespot.report.CrimeReport;
import za.co.crimespot.report.CrimeType;
import za.co.crimespot.report.ReportStatus;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Finds hotspots with DBSCAN (density-based clustering), then describes each one.
 *
 * DBSCAN: a report is a "core" point if at least {@code minPts} reports (itself included) lie within
 * {@code epsMeters}. Clusters grow from core points; reports near no cluster are noise. Unlike a fixed
 * grid, clusters can be any shape and are never split by an arbitrary cell boundary.
 *
 * Neighbour search uses a spatial hash with cells at least eps wide, so it runs in ~O(n) for typical data.
 * Pure Java, no Spring, so it's easy to unit test.
 */
public final class HotspotDetector {

    public enum Trend { RISING, STEADY, FALLING }

    public record Hotspot(String name, double lat, double lng, int radiusMeters, double intensity, int count,
                          CrimeType topType, String peakHours, Trend trend, String peakDays) {}


    private static final double RECENCY_DAYS = 14.0;
    private static final double PENDING_WEIGHT = 0.6;
    private static final double SCORE_SCALE = 4.0;
    private static final double EARTH_RADIUS_M = 6_371_000;
    private static final double M_PER_DEG_LAT = 111_320;
    private static final ZoneId SAST = ZoneId.of("Africa/Johannesburg");
    /** Default report weighting: verified counts fully, unverified at 0.6. */
    private static final java.util.function.ToDoubleFunction<CrimeReport> DEFAULT_TRUST =
            r -> r.getStatus() == ReportStatus.VERIFIED ? 1.0 : PENDING_WEIGHT;

    private HotspotDetector() {}

    public static List<Hotspot> detect(List<CrimeReport> reports, double epsMeters, int minPts, Instant now) {
        return detect(reports, epsMeters, minPts, now, DEFAULT_TRUST);
    }

    /** @param trust weight per report (e.g. from reporter trust and community confirmations), 0..1 */
    public static List<Hotspot> detect(List<CrimeReport> reports, double epsMeters, int minPts, Instant now,
                                       java.util.function.ToDoubleFunction<CrimeReport> trust) {
        int n = reports.size();
        if (n < minPts) return List.of();

        // Spatial hash. Longitude cells are sized for the highest |latitude| present, so they are at least
        // eps wide everywhere in the data set and checking the 3x3 neighbourhood can't miss a neighbour.
        double maxAbsLat = reports.stream().mapToDouble(r -> Math.abs(r.getLatitude())).max().orElse(0);
        double cellLat = epsMeters / M_PER_DEG_LAT;
        double cellLng = epsMeters / (M_PER_DEG_LAT * Math.max(0.05, Math.cos(Math.toRadians(maxAbsLat))));
        Map<Long, List<Integer>> grid = new HashMap<>();
        long[][] cellOf = new long[n][2];
        for (int i = 0; i < n; i++) {
            long cy = (long) Math.floor(reports.get(i).getLatitude() / cellLat);
            long cx = (long) Math.floor(reports.get(i).getLongitude() / cellLng);
            cellOf[i][0] = cy; cellOf[i][1] = cx;
            grid.computeIfAbsent(key(cy, cx), k -> new ArrayList<>()).add(i);
        }

        // DBSCAN
        final int UNVISITED = -2, NOISE = -1;
        int[] label = new int[n];
        Arrays.fill(label, UNVISITED);
        int clusterId = 0;
        for (int i = 0; i < n; i++) {
            if (label[i] != UNVISITED) continue;
            List<Integer> nb = neighbours(i, reports, grid, cellOf, epsMeters);
            if (nb.size() < minPts) { label[i] = NOISE; continue; }
            label[i] = clusterId;
            Deque<Integer> queue = new ArrayDeque<>(nb);
            while (!queue.isEmpty()) {
                int j = queue.poll();
                if (label[j] == NOISE) label[j] = clusterId;      // border point
                if (label[j] != UNVISITED) continue;
                label[j] = clusterId;
                List<Integer> nbj = neighbours(j, reports, grid, cellOf, epsMeters);
                if (nbj.size() >= minPts) queue.addAll(nbj);       // core point: keep expanding
            }
            clusterId++;
        }

        Map<Integer, List<CrimeReport>> clusters = new HashMap<>();
        for (int i = 0; i < n; i++) if (label[i] >= 0) clusters.computeIfAbsent(label[i], k -> new ArrayList<>()).add(reports.get(i));

        List<Hotspot> result = new ArrayList<>();
        for (List<CrimeReport> c : clusters.values()) result.add(describe(c, now, trust));
        result.sort(Comparator.comparingDouble(Hotspot::intensity).reversed());
        return result;
    }

    private static Hotspot describe(List<CrimeReport> c, Instant now, java.util.function.ToDoubleFunction<CrimeReport> trust) {
        // Weighted centre: severe, recent, verified incidents pull the centre towards them.
        double wSum = 0, lat = 0, lng = 0, score = 0;
        for (CrimeReport r : c) {
            double w = weight(r, now, trust.applyAsDouble(r));
            wSum += w; lat += r.getLatitude() * w; lng += r.getLongitude() * w; score += w;
        }
        lat /= wSum; lng /= wSum;

        // Radius covers 90% of the incidents, so one outlier doesn't inflate it.
        final double cLat = lat, cLng = lng;
        double[] d = c.stream().mapToDouble(r -> distanceMeters(cLat, cLng, r.getLatitude(), r.getLongitude())).sorted().toArray();
        double p90 = d[Math.min(d.length - 1, (int) Math.ceil(d.length * 0.9) - 1)];
        int radius = (int) Math.round(Math.max(150, Math.min(1500, p90 + 75)));

        double intensity = Math.round((1 - Math.exp(-score / SCORE_SCALE)) * 100) / 100.0;
        CrimeType topType = mostCommon(c, CrimeReport::getCrimeType).orElse(CrimeType.OTHER);
        String name = c.stream().map(CrimeReport::getLocationName).filter(s -> s != null && !s.isBlank())
                .collect(Collectors.groupingBy(String::trim, Collectors.counting()))
                .entrySet().stream().max(Map.Entry.comparingByValue()).map(Map.Entry::getKey)
                .orElse(String.format(Locale.ROOT, "Area near %.4f, %.4f", lat, lng));

        return new Hotspot(name, lat, lng, radius, intensity, c.size(), topType, peakHours(c), trend(c, now), peakDays(c));
    }

    /** WEEKEND if Fri–Sun hold ≥ 60% of incidents (vs 43% by chance), WEEKDAY if Mon–Thu hold ≥ 85%. */
    static String peakDays(List<CrimeReport> c) {
        if (c.size() < 4) return null;
        long weekend = c.stream().map(r -> r.getOccurredAt().atZone(SAST).getDayOfWeek())
                .filter(d -> d == java.time.DayOfWeek.FRIDAY || d == java.time.DayOfWeek.SATURDAY || d == java.time.DayOfWeek.SUNDAY).count();
        double share = weekend / (double) c.size();
        if (share >= 0.6) return "WEEKEND";
        if (share <= 0.15) return "WEEKDAY";
        return null;
    }

    /**
     * Risk of a hotspot at a given time, 0..1: higher inside its peak hours and days, lower outside them.
     * Used by the map ("risk now") and by safe routes (for the chosen departure time).
     */
    public static double riskAt(double intensity, String peakHours, String peakDays, java.time.ZonedDateTime when) {
        double f = 1.0;
        if (peakHours != null && peakHours.length() >= 2) {
            try {
                int start = Integer.parseInt(peakHours.substring(0, 2));
                int hour = when.withZoneSameInstant(SAST).getHour();
                f *= ((hour - start + 24) % 24) < 4 ? 1.3 : 0.6;
            } catch (NumberFormatException ignored) { }
        }
        if (peakDays != null) {
            var d = when.withZoneSameInstant(SAST).getDayOfWeek();
            boolean weekend = d == java.time.DayOfWeek.FRIDAY || d == java.time.DayOfWeek.SATURDAY || d == java.time.DayOfWeek.SUNDAY;
            f *= (peakDays.equals("WEEKEND") == weekend) ? 1.15 : 0.85;
        }
        return Math.min(1.0, Math.round(intensity * f * 100) / 100.0);
    }

    /** The 4-hour window (local time) holding the most incidents, if it holds at least half of them. */
    static String peakHours(List<CrimeReport> c) {
        if (c.size() < 3) return null;
        int[] byHour = new int[24];
        for (CrimeReport r : c) byHour[r.getOccurredAt().atZone(SAST).getHour()]++;
        int best = -1, bestCount = 0;
        for (int h = 0; h < 24; h++) {
            int sum = 0;
            for (int k = 0; k < 4; k++) sum += byHour[(h + k) % 24];
            if (sum > bestCount) { bestCount = sum; best = h; }
        }
        if (bestCount * 2 < c.size()) return null; // spread through the day
        return String.format(Locale.ROOT, "%02d:00–%02d:00", best, (best + 4) % 24);
    }

    /** Incidents per day in the last 7 days compared with the 23 days before. */
    static Trend trend(List<CrimeReport> c, Instant now) {
        Instant weekAgo = now.minus(Duration.ofDays(7));
        long recent = c.stream().filter(r -> r.getOccurredAt().isAfter(weekAgo)).count();
        long earlier = c.size() - recent;
        double recentRate = recent / 7.0, earlierRate = earlier / 23.0;
        if (recent >= 2 && recentRate > earlierRate * 1.5) return Trend.RISING;
        if (earlier >= 2 && recentRate < earlierRate * 0.5) return Trend.FALLING;
        return Trend.STEADY;
    }

    private static List<Integer> neighbours(int i, List<CrimeReport> reports, Map<Long, List<Integer>> grid,
                                            long[][] cellOf, double eps) {
        CrimeReport a = reports.get(i);
        List<Integer> out = new ArrayList<>();
        for (long dy = -1; dy <= 1; dy++) {
            for (long dx = -1; dx <= 1; dx++) {
                for (int j : grid.getOrDefault(key(cellOf[i][0] + dy, cellOf[i][1] + dx), List.of())) {
                    CrimeReport b = reports.get(j);
                    if (distanceMeters(a.getLatitude(), a.getLongitude(), b.getLatitude(), b.getLongitude()) <= eps) out.add(j);
                }
            }
        }
        return out; // includes i itself, as standard DBSCAN counts it
    }

    private static long key(long cy, long cx) { return (cy << 32) ^ (cx & 0xffffffffL); }

    static double weight(CrimeReport r, Instant now, double trust) {
        double ageDays = Math.max(0, Duration.between(r.getOccurredAt(), now).toHours() / 24.0);
        double recency = Math.exp(-ageDays / RECENCY_DAYS);
        return r.getCrimeType().severity() * recency * trust;
    }

    public static double distanceMeters(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
    }

    private static <T> Optional<T> mostCommon(List<CrimeReport> list, Function<CrimeReport, T> key) {
        return list.stream().collect(Collectors.groupingBy(key, Collectors.counting()))
                .entrySet().stream().max(Map.Entry.comparingByValue()).map(Map.Entry::getKey);
    }
}
