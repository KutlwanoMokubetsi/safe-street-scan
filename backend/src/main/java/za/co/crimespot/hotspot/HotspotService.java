package za.co.crimespot.hotspot;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import za.co.crimespot.report.CrimeReportRepository;
import za.co.crimespot.report.ReportStatus;

import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;

@Service
public class HotspotService {

    private static final Logger log = LoggerFactory.getLogger(HotspotService.class);

    private final CrimeReportRepository reports;
    private final CrimeHotspotRepository hotspots;
    private final HotspotProperties props;
    private final TransactionTemplate tx;
    private final za.co.crimespot.realtime.RealtimeHub hub;

    public HotspotService(CrimeReportRepository reports, CrimeHotspotRepository hotspots,
                          HotspotProperties props, TransactionTemplate tx, za.co.crimespot.realtime.RealtimeHub hub) {
        this.reports = reports;
        this.hotspots = hotspots;
        this.props = props;
        this.tx = tx;
        this.hub = hub;
    }

    public List<CrimeHotspot> active() {
        return hotspots.findByValidUntilAfterOrderByIntensityScoreDesc(Instant.now());
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() { regenerate(); }

    @Scheduled(cron = "${app.hotspots.cron}")
    public void scheduled() { regenerate(); }

    /** Rebuilds all hotspots from the last N days of non-rejected reports. */
    // TransactionTemplate rather than @Transactional, because this is also called
    // from inside the class (startup, schedule), which would bypass Spring's proxy.
    public synchronized int regenerate() {
        Integer count = tx.execute(status -> doRegenerate());
        return count == null ? 0 : count;
    }

    private int doRegenerate() {
        Instant now = Instant.now();
        var recent = reports.findByOccurredAtAfterAndStatusIn(
                now.minus(Duration.ofDays(props.lookbackDays())),
                EnumSet.of(ReportStatus.PENDING, ReportStatus.VERIFIED));

        var detected = HotspotDetector.detect(recent, props.cellSizeDegrees(), props.minReports(), now);

        hotspots.deleteAllHotspots();
        Instant validUntil = now.plus(Duration.ofHours(props.validHours()));
        hotspots.saveAll(detected.stream().map(d -> {
            CrimeHotspot h = new CrimeHotspot();
            h.setName(d.name());
            h.setCenterLatitude(d.lat());
            h.setCenterLongitude(d.lng());
            h.setRadiusMeters(d.radiusMeters());
            h.setIntensityScore(d.intensity());
            h.setCrimeCount(d.count());
            h.setTopCrimeType(d.topType());
            h.setGeneratedAt(now);
            h.setValidUntil(validUntil);
            return h;
        }).toList());

        hub.toAll("hotspots");
        log.info("Hotspots regenerated: {} from {} reports", detected.size(), recent.size());
        return detected.size();
    }
}
