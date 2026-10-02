package za.co.crimespot.report;

import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import za.co.crimespot.auth.AuthUser;
import za.co.crimespot.common.BadRequestException;
import za.co.crimespot.common.NotFoundException;

import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class ReportService {

    static final Set<ReportStatus> VISIBLE = EnumSet.of(ReportStatus.PENDING, ReportStatus.VERIFIED);
    private static final int MAX_REPORTS_PER_HOUR = 10;
    private static final int MAX_AREA_RESULTS = 500;

    private final CrimeReportRepository reports;
    private final za.co.crimespot.realtime.RealtimeHub hub;
    private final AreaAlertService areaAlerts;

    public ReportService(CrimeReportRepository reports, za.co.crimespot.realtime.RealtimeHub hub, AreaAlertService areaAlerts) {
        this.reports = reports;
        this.hub = hub;
        this.areaAlerts = areaAlerts;
    }

    public record CreateCommand(CrimeType crimeType, String description, String locationName,
                                double latitude, double longitude, Instant occurredAt) {}

    @Transactional
    public CrimeReport create(AuthUser me, CreateCommand cmd) {
        Instant now = Instant.now();
        if (cmd.occurredAt().isAfter(now.plus(Duration.ofMinutes(5)))) {
            throw new BadRequestException("The incident time can't be in the future");
        }
        if (cmd.occurredAt().isBefore(now.minus(Duration.ofDays(365)))) {
            throw new BadRequestException("Only incidents from the past year can be reported");
        }
        if (reports.countByUserIdAndCreatedAtAfter(me.id(), now.minus(Duration.ofHours(1))) >= MAX_REPORTS_PER_HOUR) {
            throw new BadRequestException("You've sent a lot of reports in the past hour. Try again later.");
        }
        CrimeReport r = new CrimeReport();
        r.setUserId(me.id());
        r.setCrimeType(cmd.crimeType());
        r.setDescription(cmd.description().trim());
        r.setLocationName(cmd.locationName() == null ? null : cmd.locationName().trim());
        r.setLatitude(cmd.latitude());
        r.setLongitude(cmd.longitude());
        r.setOccurredAt(cmd.occurredAt());
        // Reports from moderators are trusted straight away.
        if (me.canModerate()) {
            r.setStatus(ReportStatus.VERIFIED);
            r.setReviewedBy(me.id());
            r.setReviewedAt(now);
        }
        CrimeReport saved = reports.save(r);
        hub.toAll("reports");
        if (saved.getStatus() == ReportStatus.VERIFIED) afterCommit(() -> areaAlerts.notifyNearby(saved.getId()));
        return saved;
    }

    public List<CrimeReport> inArea(double minLat, double maxLat, double minLng, double maxLng,
                                    int days, boolean verifiedOnly) {
        Instant since = Instant.now().minus(Duration.ofDays(Math.max(1, Math.min(days, 365))));
        Set<ReportStatus> statuses = verifiedOnly ? EnumSet.of(ReportStatus.VERIFIED) : VISIBLE;
        return reports.findInArea(minLat, maxLat, minLng, maxLng, since, statuses,
                PageRequest.of(0, MAX_AREA_RESULTS));
    }

    public List<CrimeReport> recent(int limit) {
        return reports.findByStatusInOrderByOccurredAtDesc(VISIBLE, PageRequest.of(0, Math.min(limit, 50)));
    }

    public List<CrimeReport> mine(AuthUser me) {
        return reports.findByUserIdOrderByCreatedAtDesc(me.id());
    }

    public List<CrimeReport> pendingQueue() {
        return reports.findByStatusOrderByCreatedAtAsc(ReportStatus.PENDING, PageRequest.of(0, 100));
    }

    @Transactional
    public CrimeReport review(AuthUser me, UUID id, ReportStatus status) {
        if (status == ReportStatus.PENDING) throw new BadRequestException("Choose verify or reject");
        CrimeReport r = reports.findById(id).orElseThrow(() -> new NotFoundException("Report not found"));
        r.setReviewedBy(me.id());
        boolean newlyVerified = status == ReportStatus.VERIFIED && r.getStatus() != ReportStatus.VERIFIED;
        r.setStatus(status);
        r.setReviewedAt(Instant.now());
        CrimeReport saved = reports.save(r);
        hub.toAll("reports");
        if (newlyVerified) afterCommit(() -> areaAlerts.notifyNearby(saved.getId()));
        return saved;
    }

    @Transactional
    public void delete(AuthUser me, UUID id) {
        CrimeReport r = reports.findById(id).orElseThrow(() -> new NotFoundException("Report not found"));
        boolean owner = r.getUserId().equals(me.id());
        if (!me.canModerate() && !(owner && r.getStatus() == ReportStatus.PENDING)) {
            throw new AccessDeniedException("Only pending reports you wrote can be deleted");
        }
        reports.delete(r);
        hub.toAll("reports");
    }

    /** The area alert runs in the background and reads the report, so it must start after the commit. */
    private static void afterCommit(Runnable r) {
        if (org.springframework.transaction.support.TransactionSynchronizationManager.isSynchronizationActive()) {
            org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                    new org.springframework.transaction.support.TransactionSynchronization() {
                        @Override public void afterCommit() { r.run(); }
                    });
        } else {
            r.run();
        }
    }
}
