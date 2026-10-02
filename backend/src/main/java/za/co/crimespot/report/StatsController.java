package za.co.crimespot.report;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import za.co.crimespot.hotspot.CrimeHotspotRepository;

import java.time.Duration;
import java.time.Instant;

@RestController
@RequestMapping("/api/stats")
public class StatsController {

    private final CrimeReportRepository reports;
    private final CrimeHotspotRepository hotspots;

    public StatsController(CrimeReportRepository reports, CrimeHotspotRepository hotspots) {
        this.reports = reports;
        this.hotspots = hotspots;
    }

    public record Stats(long totalReports, long verifiedReports, long pendingReports,
                        long reportsLast7Days, long activeHotspots) {}

    @GetMapping
    public Stats stats() {
        Instant now = Instant.now();
        return new Stats(
                reports.countByStatusIn(ReportService.VISIBLE),
                reports.countByStatus(ReportStatus.VERIFIED),
                reports.countByStatus(ReportStatus.PENDING),
                reports.countByOccurredAtAfterAndStatusIn(now.minus(Duration.ofDays(7)), ReportService.VISIBLE),
                hotspots.countByValidUntilAfter(now));
    }
}
