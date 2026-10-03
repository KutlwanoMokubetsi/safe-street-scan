package za.co.crimespot.report;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import za.co.crimespot.auth.AuthUser;
import za.co.crimespot.common.BadRequestException;
import za.co.crimespot.common.NotFoundException;
import za.co.crimespot.common.ReadCache;
import za.co.crimespot.realtime.RealtimeHub;

import java.time.Instant;
import java.util.*;

/**
 * Reporter trust and community confirmations ("Seen it too").
 *
 * Trust score = (2·verified + 0.5·confirmations received + 1) / (2·verified + 3·rejected + 2)
 *   TRUSTED: ≥3 verified and score ≥ 0.75      LOW: ≥2 rejected and score < 0.35
 *   NEW: fewer than 3 reviewed reports          REGULAR: everyone else
 *
 * Community verification (no moderator needed): a pending report becomes VERIFIED when either
 *   - 3 different people confirm it and at least one is TRUSTED, or
 *   - its reporter is TRUSTED and a TRUSTED person confirms it.
 * Moderators can still reject it afterwards.
 */
@Service
public class TrustService {

    public enum Level { NEW, REGULAR, TRUSTED, LOW }

    private record Stats(int verified, int rejected, int confirmationsReceived) {}

    private final JdbcTemplate jdbc;
    private final CrimeReportRepository reports;
    private final ReadCache cache;
    private final RealtimeHub hub;
    private final AreaAlertService areaAlerts;

    public TrustService(JdbcTemplate jdbc, CrimeReportRepository reports, ReadCache cache, RealtimeHub hub, AreaAlertService areaAlerts) {
        this.jdbc = jdbc;
        this.reports = reports;
        this.cache = cache;
        this.hub = hub;
        this.areaAlerts = areaAlerts;
    }

    public Level level(UUID userId) {
        Stats s = stats().get(userId);
        if (s == null || s.verified() + s.rejected() < 3) return Level.NEW;
        double score = (2.0 * s.verified() + 0.5 * s.confirmationsReceived() + 1) / (2.0 * s.verified() + 3.0 * s.rejected() + 2);
        if (s.verified() >= 3 && score >= 0.75) return Level.TRUSTED;
        if (s.rejected() >= 2 && score < 0.35) return Level.LOW;
        return Level.REGULAR;
    }

    /** Everyone's stats in two grouped queries, cached until reports change. */
    private Map<UUID, Stats> stats() {
        return cache.get("trust-stats", "reports", () -> {
            Map<UUID, int[]> raw = new HashMap<>();
            jdbc.query("""
                    SELECT user_id, count(*) FILTER (WHERE status = 'VERIFIED'), count(*) FILTER (WHERE status = 'REJECTED')
                    FROM crime_reports WHERE source = 'USER' GROUP BY user_id""",
                    rs -> { raw.computeIfAbsent((UUID) rs.getObject(1), k -> new int[3])[0] = rs.getInt(2); raw.get((UUID) rs.getObject(1))[1] = rs.getInt(3); });
            jdbc.query("""
                    SELECT r.user_id, count(*) FROM report_confirmations c JOIN crime_reports r ON r.id = c.report_id
                    WHERE r.status = 'VERIFIED' GROUP BY r.user_id""",
                    rs -> { raw.computeIfAbsent((UUID) rs.getObject(1), k -> new int[3])[2] = rs.getInt(2); });
            Map<UUID, Stats> out = new HashMap<>();
            raw.forEach((k, v) -> out.put(k, new Stats(v[0], v[1], v[2])));
            return out;
        });
    }

    // ---------- confirmations ----------

    public record Confirmations(Map<UUID, Integer> counts, Set<UUID> mine) {}

    public Confirmations confirmations(List<UUID> reportIds, UUID viewer) {
        Map<UUID, Integer> counts = new HashMap<>();
        Set<UUID> mine = new HashSet<>();
        if (reportIds.isEmpty()) return new Confirmations(counts, mine);
        String in = String.join(",", Collections.nCopies(reportIds.size(), "?"));
        Object[] args = reportIds.toArray();
        jdbc.query("SELECT report_id, count(*) FROM report_confirmations WHERE report_id IN (" + in + ") GROUP BY report_id", args,
                rs -> { counts.put((UUID) rs.getObject(1), rs.getInt(2)); });
        Object[] args2 = new Object[args.length + 1];
        args2[0] = viewer;
        System.arraycopy(args, 0, args2, 1, args.length);
        jdbc.query("SELECT report_id FROM report_confirmations WHERE user_id = ? AND report_id IN (" + in + ")", args2,
                rs -> { mine.add((UUID) rs.getObject(1)); });
        return new Confirmations(counts, mine);
    }

    @Transactional
    public int confirm(AuthUser me, UUID reportId) {
        CrimeReport r = reports.findById(reportId).orElseThrow(() -> new NotFoundException("Report not found"));
        if (r.getUserId().equals(me.id())) throw new BadRequestException("You can't confirm your own report.");
        if (r.getStatus() == ReportStatus.REJECTED) throw new BadRequestException("This report isn't open for confirmation.");
        jdbc.update("INSERT INTO report_confirmations (report_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING", reportId, me.id());
        maybeCommunityVerify(r);
        cache.invalidate("reports");
        hub.toAll("reports");
        return count(reportId);
    }

    @Transactional
    public int unconfirm(AuthUser me, UUID reportId) {
        jdbc.update("DELETE FROM report_confirmations WHERE report_id = ? AND user_id = ?", reportId, me.id());
        hub.toAll("reports");
        return count(reportId);
    }

    private int count(UUID reportId) {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM report_confirmations WHERE report_id = ?", Integer.class, reportId);
        return n == null ? 0 : n;
    }

    private void maybeCommunityVerify(CrimeReport r) {
        if (r.getStatus() != ReportStatus.PENDING) return;
        List<UUID> confirmers = jdbc.queryForList("SELECT user_id FROM report_confirmations WHERE report_id = ?", UUID.class, r.getId());
        long trusted = confirmers.stream().filter(u -> level(u) == Level.TRUSTED).count();
        boolean verify = (confirmers.size() >= 3 && trusted >= 1) || (level(r.getUserId()) == Level.TRUSTED && trusted >= 1);
        if (!verify) return;
        r.setStatus(ReportStatus.VERIFIED);
        r.setReviewedAt(Instant.now()); // reviewedBy stays null: community-verified
        reports.save(r);
        UUID id = r.getId();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { areaAlerts.notifyNearby(id); }
            });
        }
    }

    /** Hotspot weight of a report: verified or well-confirmed counts fully; low-trust unconfirmed counts least. */
    public java.util.function.ToDoubleFunction<CrimeReport> hotspotTrust(List<CrimeReport> rs) {
        Map<UUID, Integer> counts = confirmations(rs.stream().filter(r -> r.getStatus() == ReportStatus.PENDING).map(CrimeReport::getId).toList(),
                new UUID(0, 0)).counts();
        return r -> {
            if (r.getStatus() == ReportStatus.VERIFIED || counts.getOrDefault(r.getId(), 0) >= 2) return 1.0;
            return level(r.getUserId()) == Level.LOW ? 0.3 : 0.6;
        };
    }

    public void requireNotRateLimited(UUID userId, long reportsInLastHour) {
        if (level(userId) == Level.LOW && reportsInLastHour >= 2) {
            throw new BadRequestException("You've reached your report limit for now. Try again later.");
        }
    }

    public void checkModerator(AuthUser me) {
        if (!me.canModerate()) throw new AccessDeniedException("Moderators only");
    }
}
