package za.co.crimespot.report;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import za.co.crimespot.hotspot.HotspotDetector;
import za.co.crimespot.push.NotificationService;
import za.co.crimespot.realtime.RealtimeHub;
import za.co.crimespot.user.User;
import za.co.crimespot.user.UserRepository;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

/** Tells people when a verified incident happens near the home area they set. Unverified reports never notify. */
@Service
public class AreaAlertService {

    private final CrimeReportRepository reports;
    private final UserRepository users;
    private final NotificationService notifications;
    private final RealtimeHub hub;

    public AreaAlertService(CrimeReportRepository reports, UserRepository users,
                            NotificationService notifications, RealtimeHub hub) {
        this.reports = reports;
        this.users = users;
        this.notifications = notifications;
        this.hub = hub;
    }

    @Async
    public void notifyNearby(UUID reportId) {
        CrimeReport r = reports.findById(reportId).orElse(null);
        if (r == null || r.getStatus() != ReportStatus.VERIFIED) return;

        String typeKey = "crime." + r.getCrimeType().name();
        for (User u : users.findByAlertRadiusMGreaterThan(0)) {
            if (u.getId().equals(r.getUserId()) || u.getHomeLat() == null || u.getHomeLng() == null) continue;
            double d = HotspotDetector.distanceMeters(u.getHomeLat(), u.getHomeLng(), r.getLatitude(), r.getLongitude());
            if (d > u.getAlertRadiusM()) continue;
            String km = d < 1000 ? Math.round(d / 100) * 100 + " m" : String.format(Locale.ROOT, "%.1f km", d / 1000);
            String lang = u.getLang();
            String title = za.co.crimespot.i18n.Messages.t(lang, "push.area.title",
                    java.util.Map.of("type", za.co.crimespot.i18n.Messages.t(lang, typeKey), "dist", km));
            String body = r.getLocationName() != null ? r.getLocationName() : za.co.crimespot.i18n.Messages.t(lang, "push.area.body");
            notifications.send(u.getId(), title, body, "/reports/" + r.getId());
            hub.notice(List.of(u.getId()), title);
        }
    }
}
