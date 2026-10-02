package za.co.crimespot;

import org.junit.jupiter.api.Test;
import za.co.crimespot.hotspot.HotspotDetector;
import za.co.crimespot.report.CrimeReport;
import za.co.crimespot.report.CrimeType;
import za.co.crimespot.report.ReportStatus;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class HotspotDetectorTest {

    private static final Instant NOW = Instant.parse("2026-10-01T12:00:00Z");

    private static CrimeReport report(double lat, double lng, CrimeType type, ReportStatus status, int daysAgo, String place) {
        CrimeReport r = new CrimeReport();
        r.setLatitude(lat);
        r.setLongitude(lng);
        r.setCrimeType(type);
        r.setStatus(status);
        r.setOccurredAt(NOW.minus(Duration.ofDays(daysAgo)));
        r.setLocationName(place);
        return r;
    }

    @Test
    void clusterBecomesHotspotAndSparseAreaDoesNot() {
        List<CrimeReport> reports = new ArrayList<>();
        // Four robberies around Joburg CBD within ~200 m
        for (int i = 0; i < 4; i++) {
            reports.add(report(-26.2041 + i * 0.0003, 28.0473, CrimeType.ROBBERY, ReportStatus.VERIFIED, 1, "Park Station"));
        }
        // A single report far away
        reports.add(report(-33.9249, 18.4241, CrimeType.THEFT, ReportStatus.PENDING, 2, "Cape Town CBD"));

        var hotspots = HotspotDetector.detect(reports, 0.005, 3, NOW);

        assertEquals(1, hotspots.size());
        var h = hotspots.get(0);
        assertEquals("Park Station", h.name());
        assertEquals(4, h.count());
        assertEquals(CrimeType.ROBBERY, h.topType());
        assertTrue(h.intensity() > 0.5 && h.intensity() <= 1.0);
        assertTrue(h.radiusMeters() >= 150);
    }

    @Test
    void oldPendingMinorCrimesScoreLowerThanRecentVerifiedViolentCrimes() {
        List<CrimeReport> minor = new ArrayList<>();
        List<CrimeReport> violent = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            minor.add(report(-26.1, 28.0, CrimeType.VANDALISM, ReportStatus.PENDING, 25, null));
            violent.add(report(-26.1, 28.0, CrimeType.HIJACKING, ReportStatus.VERIFIED, 0, null));
        }
        double minorScore = HotspotDetector.detect(minor, 0.005, 3, NOW).get(0).intensity();
        double violentScore = HotspotDetector.detect(violent, 0.005, 3, NOW).get(0).intensity();
        assertTrue(violentScore > minorScore);
    }
}
