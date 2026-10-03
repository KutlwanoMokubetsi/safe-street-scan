package za.co.crimespot.panic;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import za.co.crimespot.common.NotFoundException;
import za.co.crimespot.friends.FriendshipRepository;
import za.co.crimespot.location.LocationService;
import za.co.crimespot.location.ShareReason;
import za.co.crimespot.location.UserLocation;
import za.co.crimespot.push.NotificationService;
import za.co.crimespot.user.User;
import za.co.crimespot.user.UserRepository;

import java.time.Instant;
import java.util.*;

@Service
public class PanicService {

    private final PanicAlertRepository alerts;
    private final LocationService locations;
    private final FriendshipRepository friendships;
    private final UserRepository users;
    private final NotificationService notifications;
    private final za.co.crimespot.realtime.RealtimeHub hub;
    private final za.co.crimespot.location.LocationShareRepository shares;
    private final za.co.crimespot.groups.GroupService groups;

    public PanicService(PanicAlertRepository alerts, LocationService locations, FriendshipRepository friendships,
                        UserRepository users, NotificationService notifications,
                        za.co.crimespot.realtime.RealtimeHub hub, za.co.crimespot.location.LocationShareRepository shares,
                        za.co.crimespot.groups.GroupService groups) {
        this.alerts = alerts;
        this.locations = locations;
        this.friendships = friendships;
        this.users = users;
        this.notifications = notifications;
        this.hub = hub;
        this.shares = shares;
        this.groups = groups;
    }

    /** Friends, plus members of groups where this person chose to share their SOS. */
    private List<UUID> audience(UUID me) {
        Set<UUID> all = new LinkedHashSet<>(friendships.friendIdsOf(me));
        all.addAll(groups.sosAudience(me));
        return new ArrayList<>(all);
    }

    private static final com.fasterxml.jackson.databind.ObjectMapper JSON = new com.fasterxml.jackson.databind.ObjectMapper();

    private static final java.time.format.DateTimeFormatter HHMM =
            java.time.format.DateTimeFormatter.ofPattern("HH:mm").withZone(java.time.ZoneId.of("Africa/Johannesburg"));

    /** Someone set "check in by" and didn't: raise an alert for them automatically. */
    @org.springframework.scheduling.annotation.Scheduled(fixedDelay = 30_000)
    @Transactional
    public void escalateMissedCheckins() {
        Instant now = Instant.now();
        for (za.co.crimespot.location.LocationShare s : shares.overdueCheckins(now)) {
            s.setEscalatedAt(now);
            shares.save(s);
            var loc = locations.location(s.getUserId()).orElse(null);
            trigger(s.getUserId(),
                    loc == null ? null : loc.getLatitude(), loc == null ? null : loc.getLongitude(),
                    loc == null ? null : loc.getAccuracyM(),
                    "Didn't check in by " + HHMM.format(s.getCheckinDueAt()) + ". Sent automatically, so please try to reach them.");
        }
    }

    /** Raises an alert, or refreshes the position of one that is already active. Never rate-limited. */
    @Transactional
    public PanicAlert trigger(UUID me, Double lat, Double lng, Double accuracy, String message) {
        Optional<PanicAlert> existing = alerts.findFirstByUserIdAndStatusOrderByCreatedAtDesc(me, PanicStatus.ACTIVE);
        if (existing.isPresent()) {
            if (lat != null && lng != null) locations.update(me, lat, lng, accuracy);
            return existing.get();
        }

        PanicAlert a = new PanicAlert();
        a.setUserId(me);
        a.setLatitude(lat);
        a.setLongitude(lng);
        a.setAccuracyM(accuracy);
        a.setMessage(message == null || message.isBlank() ? null : message.trim());
        alerts.save(a);

        // Friends can follow the person live until the alert is resolved.
        locations.startPanicShare(me, groups.sosAudience(me));
        if (lat != null && lng != null) locations.update(me, lat, lng, accuracy);

        List<UUID> friends = audience(me);
        String name = users.findById(me).map(User::displayName).orElse("A friend");
        var p = Map.of("name", name);
        String custom = a.getMessage();
        notifications.sendLocalized(friends, l -> new String[] {
                za.co.crimespot.i18n.Messages.t(l, "push.sos.title", p),
                custom != null ? custom : za.co.crimespot.i18n.Messages.t(l, "push.sos.body") }, "/alerts/" + a.getId(), true);
        List<UUID> to = new ArrayList<>(friends);
        to.add(me);
        hub.toUsers(to, "live");
        return a;
    }

    @Transactional
    public PanicAlert resolve(UUID me, UUID alertId) {
        PanicAlert a = alerts.findById(alertId).orElseThrow(() -> new NotFoundException("Alert not found"));
        if (!a.getUserId().equals(me)) throw new AccessDeniedException("Only the person who raised the alert can end it");
        if (a.getStatus() == PanicStatus.RESOLVED) return a;

        a.setStatus(PanicStatus.RESOLVED);
        a.setResolvedAt(Instant.now());
        alerts.save(a);
        locations.stop(me, ShareReason.PANIC);

        String name = users.findById(me).map(User::displayName).orElse("Your friend");
        var p = Map.of("name", name);
        notifications.sendLocalized(audience(me), l -> new String[] {
                za.co.crimespot.i18n.Messages.t(l, "push.safe.title", p), za.co.crimespot.i18n.Messages.t(l, "push.safe.body", p) },
                "/alerts/" + a.getId(), false);
        List<UUID> to = new ArrayList<>(audience(me));
        to.add(me);
        hub.toUsers(to, "live");
        hub.noticeLocalized(audience(me), l -> za.co.crimespot.i18n.Messages.t(l, "push.safe.title", p));
        return a;
    }

    public Optional<PanicAlert> activeFor(UUID me) {
        return alerts.findFirstByUserIdAndStatusOrderByCreatedAtDesc(me, PanicStatus.ACTIVE);
    }

    public List<PanicAlert> activeAmongFriends(UUID me) {
        Set<UUID> sources = new LinkedHashSet<>(friendships.friendIdsOf(me));
        sources.addAll(groups.sosSourcesFor(me));
        List<UUID> friends = new ArrayList<>(sources);
        return friends.isEmpty() ? List.of() : alerts.findByUserIdInAndStatusOrderByCreatedAtDesc(friends, PanicStatus.ACTIVE);
    }

    /** Loads an alert for its owner or one of their friends. */
    public PanicAlert loadFor(UUID viewer, UUID alertId) {
        PanicAlert a = alerts.findById(alertId).orElseThrow(() -> new NotFoundException("Alert not found"));
        if (!a.getUserId().equals(viewer) && !friendships.friendIdsOf(viewer).contains(a.getUserId())
                && !groups.sosSourcesFor(viewer).contains(a.getUserId())) {
            throw new AccessDeniedException("This alert isn't shared with you");
        }
        return a;
    }

    public AlertDto toDto(UUID viewer, PanicAlert a) {
        User owner = users.findById(a.getUserId()).orElseThrow(() -> new NotFoundException("User not found"));
        Double lat = a.getLatitude(), lng = a.getLongitude(), acc = a.getAccuracyM();
        Instant at = a.getCreatedAt();
        if (a.getStatus() == PanicStatus.ACTIVE && locations.canSee(viewer, owner.getId())) {
            Optional<UserLocation> live = locations.location(owner.getId());
            if (live.isPresent()) {
                lat = live.get().getLatitude();
                lng = live.get().getLongitude();
                acc = live.get().getAccuracyM();
                at = live.get().getUpdatedAt();
            }
        }
        za.co.crimespot.user.EmergencyInfo emergency = null;
        // The emergency card is for friends only (that's what the person agreed to), not group members.
        boolean friendOrSelf = viewer.equals(owner.getId()) || friendships.friendIdsOf(owner.getId()).contains(viewer);
        if (friendOrSelf && a.getStatus() == PanicStatus.ACTIVE && owner.isEmergencyConsent() && owner.getEmergencyInfoJson() != null) {
            try {
                emergency = JSON.readValue(owner.getEmergencyInfoJson(), za.co.crimespot.user.EmergencyInfo.class);
            } catch (Exception ignored) { }
        }
        return new AlertDto(a.getId(), owner.getId(), owner.displayName(), owner.getPhone(), a.getStatus(),
                a.getMessage(), a.getCreatedAt(), a.getResolvedAt(), lat, lng, acc, at, emergency);
    }
}
