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

    public PanicService(PanicAlertRepository alerts, LocationService locations, FriendshipRepository friendships,
                        UserRepository users, NotificationService notifications) {
        this.alerts = alerts;
        this.locations = locations;
        this.friendships = friendships;
        this.users = users;
        this.notifications = notifications;
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
        locations.startPanicShare(me);
        if (lat != null && lng != null) locations.update(me, lat, lng, accuracy);

        List<UUID> friends = friendships.friendIdsOf(me);
        String name = users.findById(me).map(User::displayName).orElse("A friend");
        String body = a.getMessage() != null ? a.getMessage() : "Tap to see where they are and call them.";
        notifications.sendToAll(friends, "🚨 " + name + " needs help", body, "/alerts/" + a.getId(), true);
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
        notifications.sendToAll(friendships.friendIdsOf(me), name + " is safe",
                name + " ended their emergency alert.", "/alerts/" + a.getId(), false);
        return a;
    }

    public Optional<PanicAlert> activeFor(UUID me) {
        return alerts.findFirstByUserIdAndStatusOrderByCreatedAtDesc(me, PanicStatus.ACTIVE);
    }

    public List<PanicAlert> activeAmongFriends(UUID me) {
        List<UUID> friends = friendships.friendIdsOf(me);
        return friends.isEmpty() ? List.of() : alerts.findByUserIdInAndStatusOrderByCreatedAtDesc(friends, PanicStatus.ACTIVE);
    }

    /** Loads an alert for its owner or one of their friends. */
    public PanicAlert loadFor(UUID viewer, UUID alertId) {
        PanicAlert a = alerts.findById(alertId).orElseThrow(() -> new NotFoundException("Alert not found"));
        if (!a.getUserId().equals(viewer) && !friendships.friendIdsOf(viewer).contains(a.getUserId())) {
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
        return new AlertDto(a.getId(), owner.getId(), owner.displayName(), owner.getPhone(), a.getStatus(),
                a.getMessage(), a.getCreatedAt(), a.getResolvedAt(), lat, lng, acc, at);
    }
}
