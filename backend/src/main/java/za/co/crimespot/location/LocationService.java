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

    public LocationService(LocationShareRepository shares, UserLocationRepository locations,
                           FriendshipRepository friendships, UserRepository users,
                           NotificationService notifications) {
        this.shares = shares;
        this.locations = locations;
        this.friendships = friendships;
        this.users = users;
        this.notifications = notifications;
    }

    /**
     * Starts sharing with chosen friends (or all friends if none are chosen).
     * {@code minutes} is 60, 480, or null for "until I stop". Replaces any earlier manual share.
     */
    @Transactional
    public LocationShare startManual(UUID me, Integer minutes, Collection<UUID> friendIds) {
        if (minutes != null && !ALLOWED_MINUTES.contains(minutes)) {
            throw new BadRequestException("Choose 1 hour, 8 hours, or until you stop");
        }
        Set<UUID> friends = new HashSet<>(friendships.friendIdsOf(me));
        if (friends.isEmpty()) throw new BadRequestException("Add a friend first, then you can share your location with them.");

        Set<UUID> viewers = (friendIds == null || friendIds.isEmpty()) ? friends : new HashSet<>(friendIds);
        viewers.retainAll(friends); // Never share with someone who isn't a friend.
        if (viewers.isEmpty()) throw new BadRequestException("Choose at least one friend to share with.");

        Instant now = Instant.now();
        endActive(me, ShareReason.MANUAL, now);
        LocationShare s = newShare(me, ShareReason.MANUAL, viewers, now,
                minutes == null ? null : now.plus(Duration.ofMinutes(minutes)));

        String name = users.findById(me).map(User::displayName).orElse("A friend");
        String until = minutes == null ? "until they stop" : "for the next " + (minutes == 60 ? "hour" : "8 hours");
        notifications.sendToAll(viewers, name + " is sharing their location",
                "You can see where they are " + until + ".", "/live", false);
        return s;
    }

    @Transactional
    public LocationShare startPanicShare(UUID me) {
        Instant now = Instant.now();
        endActive(me, ShareReason.PANIC, now);
        return newShare(me, ShareReason.PANIC, new HashSet<>(friendships.friendIdsOf(me)), now, null);
    }

    @Transactional
    public void stop(UUID me, ShareReason reason) {
        endActive(me, reason, Instant.now());
        locations.deleteWhereNotSharing();
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
    }

    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void expire() {
        shares.endExpired(Instant.now());
        locations.deleteWhereNotSharing();
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
