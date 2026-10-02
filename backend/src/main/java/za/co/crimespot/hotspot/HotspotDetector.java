package za.co.crimespot.hotspot;

import za.co.crimespot.report.CrimeReport;
import za.co.crimespot.report.CrimeType;
import za.co.crimespot.report.ReportStatus;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Pure grid-clustering logic, kept free of Spring so it is easy to unit test.
 * Reports are bucketed into square cells; busy cells become hotspots. Each report is
 * weighted by crime severity, recency (half-life of about 10 days) and whether a
 * moderator verified it.
 */
public final class HotspotDetector {

    public record Hotspot(String name, double lat, double lng, int radiusMeters,
                          double intensity, int count, CrimeType topType) {}

    private static final double RECENCY_DAYS = 14.0;
    private static final double PENDING_WEIGHT = 0.6;
    private static final double SCORE_SCALE = 4.0;
    private static final double EARTH_RADIUS_M = 6_371_000;

    private HotspotDetector() {}

    public static List<Hotspot> detect(List<CrimeReport> reports, double cellSize, int minReports, Instant now) {
        Map<String, List<CrimeReport>> cells = reports.stream().collect(Collectors.groupingBy(
                r -> (long) Math.floor(r.getLatitude() / cellSize) + ":" + (long) Math.floor(r.getLongitude() / cellSize)));

        List<Hotspot> result = new ArrayList<>();
        for (List<CrimeReport> cell : cells.values()) {
            if (cell.size() < minReports) continue;

            double lat = cell.stream().mapToDouble(CrimeReport::getLatitude).average().orElseThrow();
            double lng = cell.stream().mapToDouble(CrimeReport::getLongitude).average().orElseThrow();
            double maxDist = cell.stream().mapToDouble(r -> distanceMeters(lat, lng, r.getLatitude(), r.getLongitude()))
                    .max().orElse(0);
            int radius = (int) Math.round(Math.max(150, Math.min(1000, maxDist + 75)));

            double score = cell.stream().mapToDouble(r -> weight(r, now)).sum();
            double intensity = Math.round((1 - Math.exp(-score / SCORE_SCALE)) * 100) / 100.0;

            CrimeType topType = mostCommon(cell, CrimeReport::getCrimeType).orElse(CrimeType.OTHER);
            String name = cell.stream().map(CrimeReport::getLocationName)
                    .filter(n -> n != null && !n.isBlank())
                    .collect(Collectors.groupingBy(String::trim, Collectors.counting()))
                    .entrySet().stream().max(Map.Entry.comparingByValue()).map(Map.Entry::getKey)
                    .orElse(String.format(Locale.ROOT, "Area near %.4f, %.4f", lat, lng));

            result.add(new Hotspot(name, lat, lng, radius, intensity, cell.size(), topType));
        }
        result.sort(Comparator.comparingDouble(Hotspot::intensity).reversed());
        return result;
    }

    static double weight(CrimeReport r, Instant now) {
        double ageDays = Math.max(0, Duration.between(r.getOccurredAt(), now).toHours() / 24.0);
        double recency = Math.exp(-ageDays / RECENCY_DAYS);
        double trust = r.getStatus() == ReportStatus.VERIFIED ? 1.0 : PENDING_WEIGHT;
        return r.getCrimeType().severity() * recency * trust;
    }

    static double distanceMeters(double lat1, double lng1, double lat2, double lng2) {
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
