package za.co.crimespot.location;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import za.co.crimespot.common.BadRequestException;
import za.co.crimespot.common.ConflictException;
import za.co.crimespot.friends.FriendshipRepository;
import za.co.crimespot.push.NotificationService;
import za.co.crimespot.user.User;
import za.co.crimespot.user.UserRepository;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Service
public class LocationService {

    static final Set<Integer> ALLOWED_MINUTES = Set.of(60, 480);

    private final LocationShareRepository shares;
    private final UserLocationRepository locations;
    private final FriendshipRepository friendships;
    private final UserRepository users;
    private final NotificationService notifications;
    private final za.co.crimespot.realtime.RealtimeHub hub;
    private final org.springframework.context.ApplicationEventPublisher events;

    public LocationService(LocationShareRepository shares, UserLocationRepository locations,
                           FriendshipRepository friendships, UserRepository users,
                           NotificationService notifications, za.co.crimespot.realtime.RealtimeHub hub,
                           org.springframework.context.ApplicationEventPublisher events) {
        this.shares = shares;
        this.locations = locations;
        this.friendships = friendships;
        this.users = users;
        this.notifications = notifications;
        this.hub = hub;
        this.events = events;
    }

    /** Everyone currently allowed to see this user, plus the user's own devices. */
    private Set<UUID> audience(UUID me) {
        Set<UUID> to = new HashSet<>();
        to.add(me);
        shares.active(me, Instant.now()).forEach(s -> to.addAll(s.getViewers()));
        return to;
    }

    /**
     * Starts sharing with chosen friends (or all friends if none are chosen).
     * {@code minutes} is 60, 480, or null for "until I stop". Replaces any earlier manual share.
     */
    @Transactional
    public LocationShare startManual(UUID me, Integer minutes, Collection<UUID> friendIds, Integer checkInMinutes) {
        if (minutes != null && !ALLOWED_MINUTES.contains(minutes)) {
            throw new BadRequestException("Choose 1 hour, 8 hours, or until you stop");
        }
        if (checkInMinutes != null && (checkInMinutes < 10 || checkInMinutes > 720)) {
            throw new BadRequestException("Choose a check-in time between 10 minutes and 12 hours");
        }
        if (checkInMinutes != null && minutes != null && checkInMinutes > minutes) {
            throw new BadRequestException("Check-in must be before sharing ends");
        }
        Set<UUID> friends = new HashSet<>(friendships.friendIdsOf(me));
        if (friends.isEmpty()) throw new BadRequestException("Add a friend first, then you can share your location with them.");

        Set<UUID> viewers = (friendIds == null || friendIds.isEmpty()) ? friends : new HashSet<>(friendIds);
        viewers.retainAll(friends); // Never share with someone who isn't a friend.
        if (viewers.isEmpty()) throw new BadRequestException("Choose at least one friend to share with.");

        Instant now = Instant.now();
        endActive(me, ShareReason.MANUAL, now);
        Set<UUID> previous = audience(me);
        LocationShare s = newShare(me, ShareReason.MANUAL, viewers, now,
                minutes == null ? null : now.plus(Duration.ofMinutes(minutes)));
        if (checkInMinutes != null) {
            s.setCheckinDueAt(now.plus(Duration.ofMinutes(checkInMinutes)));
            s = shares.save(s);
        }
        previous.addAll(viewers);
        hub.toUsers(previous, "live");

        String name = users.findById(me).map(User::displayName).orElse("A friend");
        var p = java.util.Map.of("name", name);
        notifications.sendLocalized(viewers, l -> new String[] {
                za.co.crimespot.i18n.Messages.t(l, "push.share.title", p), za.co.crimespot.i18n.Messages.t(l, "push.share.body") }, "/live", false);
        return s;
    }

    @Transactional
    public LocationShare startPanicShare(UUID me, Set<UUID> extraViewers) {
        Instant now = Instant.now();
        endActive(me, ShareReason.PANIC, now);
        Set<UUID> viewers = new HashSet<>(friendships.friendIdsOf(me));
        viewers.addAll(extraViewers);
        LocationShare s = newShare(me, ShareReason.PANIC, viewers, now, null);
        hub.toUsers(audience(me), "live");
        return s;
    }

    /** Escort sharing: only the escort sees you, for up to 6 hours or until the walk ends. */
    @Transactional
    public LocationShare startEscortShare(UUID walker, UUID escort) {
        Instant now = Instant.now();
        endActive(walker, ShareReason.ESCORT, now);
        LocationShare s = newShare(walker, ShareReason.ESCORT, new HashSet<>(Set.of(escort)), now, now.plus(Duration.ofHours(6)));
        hub.toUsers(List.of(walker, escort), "live");
        return s;
    }

    /** "I've arrived": ends the manual share and tells the friends who were watching. */
    @Transactional
    public void checkIn(UUID me) {
        LocationShare s = active(me, ShareReason.MANUAL)
                .orElseThrow(() -> new ConflictException("You're not sharing your location"));
        Set<UUID> viewers = new HashSet<>(s.getViewers());
        Set<UUID> to = audience(me);
        stop(me, ShareReason.MANUAL);
        String name = users.findById(me).map(User::displayName).orElse("Your friend");
        var p = java.util.Map.of("name", name);
        notifications.sendLocalized(viewers, l -> new String[] {
                za.co.crimespot.i18n.Messages.t(l, "push.checkin.title", p), za.co.crimespot.i18n.Messages.t(l, "push.checkin.body", p) }, "/live", false);
        hub.noticeLocalized(viewers, l -> za.co.crimespot.i18n.Messages.t(l, "push.checkin.title", p));
        hub.toUsers(to, "live");
    }

    @Transactional
    public void stop(UUID me, ShareReason reason) {
        Set<UUID> to = audience(me);
        endActive(me, reason, Instant.now());
        locations.deleteWhereNotSharing();
        hub.toUsers(to, "live");
    }

    @Transactional
    public void update(UUID me, double lat, double lng, Double accuracy) {
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new BadRequestException("Invalid coordinates");
        if (shares.active(me, Instant.now()).isEmpty()) {
            throw new ConflictException("You're not sharing your location");
        }
        UserLocation loc = locations.findById(me).orElseGet(() -> {
            UserLocation l = new UserLocation();
            l.setUserId(me);
            return l;
        });
        loc.setLatitude(lat);
        loc.setLongitude(lng);
        loc.setAccuracyM(accuracy);
        loc.setUpdatedAt(Instant.now());
        locations.save(loc);
        hub.toUsers(audience(me), "live");
        events.publishEvent(new LocationUpdated(me, lat, lng));
    }

    public Optional<LocationShare> active(UUID me, ShareReason reason) {
        return shares.active(me, Instant.now()).stream().filter(s -> s.getReason() == reason).findFirst();
    }

    public boolean isSharing(UUID me) {
        return !shares.active(me, Instant.now()).isEmpty();
    }

    /** Active shares other people have opened to this viewer, newest first per person. */
    public List<LocationShare> visibleTo(UUID viewer) {
        return shares.visibleTo(viewer, Instant.now());
    }

    public Optional<UserLocation> location(UUID userId) {
        return locations.findById(userId);
    }

    /** True if {@code viewer} may currently see {@code owner}'s position. */
    public boolean canSee(UUID viewer, UUID owner) {
        if (viewer.equals(owner)) return true;
        return shares.active(owner, Instant.now()).stream().anyMatch(s -> s.getViewers().contains(viewer));
    }

    @Transactional
    public void removeViewer(UUID owner, UUID viewer) {
        shares.removeViewer(owner, viewer);
        hub.toUsers(List.of(owner, viewer), "live");
    }

    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void expire() {
        Instant now = Instant.now();
        Set<UUID> to = new HashSet<>();
        for (LocationShare s : shares.expiring(now)) { to.add(s.getUserId()); to.addAll(s.getViewers()); }
        if (to.isEmpty()) return;
        shares.endExpired(now);
        locations.deleteWhereNotSharing();
        hub.toUsers(to, "live");
    }

    private void endActive(UUID me, ShareReason reason, Instant now) {
        for (LocationShare s : shares.active(me, now)) {
            if (s.getReason() == reason) {
                s.setEndedAt(now);
                shares.save(s);
            }
        }
    }

    private LocationShare newShare(UUID me, ShareReason reason, Set<UUID> viewers, Instant now, Instant expires) {
        LocationShare s = new LocationShare();
        s.setUserId(me);
        s.setReason(reason);
        s.setStartedAt(now);
        s.setExpiresAt(expires);
        s.setViewers(viewers);
        return shares.save(s);
    }
}
