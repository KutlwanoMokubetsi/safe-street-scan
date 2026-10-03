package za.co.crimespot.escort;

import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import za.co.crimespot.common.BadRequestException;
import za.co.crimespot.common.NotFoundException;
import za.co.crimespot.friends.FriendshipRepository;
import za.co.crimespot.hotspot.HotspotDetector;
import za.co.crimespot.i18n.Messages;
import za.co.crimespot.location.LocationService;
import za.co.crimespot.location.LocationUpdated;
import za.co.crimespot.location.ShareReason;
import za.co.crimespot.panic.AlertDto;
import za.co.crimespot.panic.PanicService;
import za.co.crimespot.push.NotificationService;
import za.co.crimespot.realtime.RealtimeHub;
import za.co.crimespot.user.User;
import za.co.crimespot.user.UserRepository;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * "Walk with me": a friend virtually escorts you until you arrive.
 *  - The escort sees your live location (an ESCORT share visible only to them).
 *  - No movement of 40 m for 3 minutes → escort is notified and you're asked "Are you OK?".
 *  - No location update for 2.5 minutes → escort is told contact was lost.
 *  - The escort can raise an SOS on your behalf.
 */
@Service
public class EscortService {

    private static final double MOVE_M = 40;
    private static final Duration STILL = Duration.ofMinutes(3);
    private static final Duration LOST = Duration.ofSeconds(150);
    private static final List<EscortSession.Status> OPEN = List.of(EscortSession.Status.REQUESTED, EscortSession.Status.ACTIVE);

    public record SessionDto(UUID id, String status, UUID walkerId, String walkerName, UUID escortId, String escortName,
                             Instant startedAt, boolean stationary, boolean lost) {}
    public record Overview(SessionDto asWalker, List<SessionDto> asEscort, List<SessionDto> incoming) {}

    private final EscortSessionRepository sessions;
    private final FriendshipRepository friendships;
    private final UserRepository users;
    private final LocationService locations;
    private final PanicService panic;
    private final NotificationService notifications;
    private final RealtimeHub hub;

    public EscortService(EscortSessionRepository sessions, FriendshipRepository friendships, UserRepository users,
                         LocationService locations, PanicService panic, NotificationService notifications, RealtimeHub hub) {
        this.sessions = sessions;
        this.friendships = friendships;
        this.users = users;
        this.locations = locations;
        this.panic = panic;
        this.notifications = notifications;
        this.hub = hub;
    }

    public Overview overview(UUID me) {
        SessionDto mine = sessions.findByWalkerIdAndStatusIn(me, OPEN).stream().findFirst().map(this::dto).orElse(null);
        List<SessionDto> escorting = new ArrayList<>(), incoming = new ArrayList<>();
        for (EscortSession s : sessions.findByEscortIdAndStatusIn(me, OPEN)) {
            (s.getStatus() == EscortSession.Status.REQUESTED ? incoming : escorting).add(dto(s));
        }
        return new Overview(mine, escorting, incoming);
    }

    @Transactional
    public SessionDto request(UUID walker, UUID friendId) {
        if (!friendships.friendIdsOf(walker).contains(friendId)) throw new BadRequestException("Choose one of your friends.");
        for (EscortSession s : sessions.findByWalkerIdAndStatusIn(walker, OPEN)) end(s, false); // one walk at a time
        EscortSession s = new EscortSession();
        s.setWalkerId(walker);
        s.setEscortId(friendId);
        sessions.save(s);
        String name = name(walker);
        notifications.sendLocalized(List.of(friendId), l -> new String[] {
                Messages.t(l, "push.walk.request.title", Map.of("name", name)), Messages.t(l, "push.walk.request.body") }, "/live", true);
        hub.toUsers(List.of(walker, friendId), "live");
        return dto(s);
    }

    @Transactional
    public SessionDto accept(UUID me, UUID id) {
        EscortSession s = load(id);
        if (!s.getEscortId().equals(me) || s.getStatus() != EscortSession.Status.REQUESTED) throw new AccessDeniedException("Not your request");
        s.setStatus(EscortSession.Status.ACTIVE);
        s.setStartedAt(Instant.now());
        s.setLastMovedAt(Instant.now());
        locations.location(s.getWalkerId()).ifPresent(l -> { s.setAnchorLat(l.getLatitude()); s.setAnchorLng(l.getLongitude()); });
        sessions.save(s);
        locations.startEscortShare(s.getWalkerId(), me);
        String name = name(me);
        notifications.sendLocalized(List.of(s.getWalkerId()), l -> new String[] {
                Messages.t(l, "push.walk.accepted.title", Map.of("name", name)), Messages.t(l, "push.walk.accepted.body") }, "/live", false);
        hub.toUsers(List.of(s.getWalkerId(), me), "live");
        return dto(s);
    }

    @Transactional
    public void decline(UUID me, UUID id) {
        EscortSession s = load(id);
        if (!s.getEscortId().equals(me)) throw new AccessDeniedException("Not your request");
        s.setStatus(EscortSession.Status.DECLINED);
        s.setEndedAt(Instant.now());
        sessions.save(s);
        hub.toUsers(List.of(s.getWalkerId(), me), "live");
    }

    /** Either person can end it; when the walker ends it, the escort hears they arrived safely. */
    @Transactional
    public void finish(UUID me, UUID id) {
        EscortSession s = load(id);
        if (!s.getWalkerId().equals(me) && !s.getEscortId().equals(me)) throw new AccessDeniedException("Not your walk");
        end(s, s.getWalkerId().equals(me));
    }

    /** "I'm OK" after a stationary prompt: restarts the 3-minute timer. */
    @Transactional
    public void ok(UUID me, UUID id) {
        EscortSession s = load(id);
        if (!s.getWalkerId().equals(me)) throw new AccessDeniedException("Not your walk");
        s.setLastMovedAt(Instant.now());
        s.setStationaryAlerted(false);
        sessions.save(s);
        hub.toUsers(List.of(me, s.getEscortId()), "live");
    }

    /** The escort raises an SOS for the walker: goes to all the walker's friends with their last location. */
    @Transactional
    public AlertDto raiseAlert(UUID me, UUID id) {
        EscortSession s = load(id);
        if (!s.getEscortId().equals(me) || s.getStatus() != EscortSession.Status.ACTIVE) throw new AccessDeniedException("Not your walk");
        var loc = locations.location(s.getWalkerId()).orElse(null);
        var alert = panic.trigger(s.getWalkerId(),
                loc == null ? null : loc.getLatitude(), loc == null ? null : loc.getLongitude(), loc == null ? null : loc.getAccuracyM(),
                "Raised by " + name(me) + ", who was walking with them on CrimeSpot.");
        return panic.toDto(me, alert);
    }

    // ---------- movement monitoring ----------

    @EventListener
    @Transactional
    public void onLocation(LocationUpdated e) {
        for (EscortSession s : sessions.findByWalkerIdAndStatusIn(e.userId(), List.of(EscortSession.Status.ACTIVE))) {
            boolean moved = s.getAnchorLat() == null
                    || HotspotDetector.distanceMeters(s.getAnchorLat(), s.getAnchorLng(), e.lat(), e.lng()) >= MOVE_M;
            if (moved) {
                s.setAnchorLat(e.lat());
                s.setAnchorLng(e.lng());
                s.setLastMovedAt(Instant.now());
                s.setStationaryAlerted(false);
            }
            s.setLostAlerted(false); // updates are arriving again
            sessions.save(s);
        }
    }

    @Scheduled(fixedDelay = 30_000)
    @Transactional
    public void monitor() {
        Instant now = Instant.now();
        for (EscortSession s : sessions.findByStatus(EscortSession.Status.ACTIVE)) {
            if (s.getStartedAt() != null && s.getStartedAt().isBefore(now.minus(Duration.ofHours(6)))) { end(s, false); continue; }
            String walker = name(s.getWalkerId());
            Map<String, String> p = Map.of("name", walker);

            if (!s.isStationaryAlerted() && s.getLastMovedAt() != null && s.getLastMovedAt().isBefore(now.minus(STILL))) {
                s.setStationaryAlerted(true);
                sessions.save(s);
                notifications.sendLocalized(List.of(s.getEscortId()), l -> new String[] {
                        Messages.t(l, "push.walk.still.title", p), Messages.t(l, "push.walk.still.body") }, "/live", true);
                hub.toUsers(List.of(s.getWalkerId(), s.getEscortId()), "live");
            }
            Instant last = locations.location(s.getWalkerId()).map(l -> l.getUpdatedAt()).orElse(s.getStartedAt());
            if (!s.isLostAlerted() && last != null && last.isBefore(now.minus(LOST))) {
                s.setLostAlerted(true);
                sessions.save(s);
                notifications.sendLocalized(List.of(s.getEscortId()), l -> new String[] {
                        Messages.t(l, "push.walk.lost.title", p), Messages.t(l, "push.walk.lost.body") }, "/live", true);
                hub.toUsers(List.of(s.getWalkerId(), s.getEscortId()), "live");
            }
        }
        // Requests nobody answered within 10 minutes lapse.
        for (EscortSession s : sessions.findByStatusAndCreatedAtBefore(EscortSession.Status.REQUESTED, now.minus(Duration.ofMinutes(10)))) {
            s.setStatus(EscortSession.Status.DECLINED);
            s.setEndedAt(now);
            sessions.save(s);
            hub.toUsers(List.of(s.getWalkerId(), s.getEscortId()), "live");
        }
    }

    // ---------- helpers ----------

    private void end(EscortSession s, boolean arrived) {
        boolean wasActive = s.getStatus() == EscortSession.Status.ACTIVE;
        s.setStatus(EscortSession.Status.ENDED);
        s.setEndedAt(Instant.now());
        sessions.save(s);
        if (wasActive) locations.stop(s.getWalkerId(), ShareReason.ESCORT);
        if (arrived && wasActive) {
            Map<String, String> p = Map.of("name", name(s.getWalkerId()));
            notifications.sendLocalized(List.of(s.getEscortId()), l -> new String[] {
                    Messages.t(l, "push.walk.arrived.title", p), Messages.t(l, "push.walk.arrived.body") }, "/live", false);
        }
        hub.toUsers(List.of(s.getWalkerId(), s.getEscortId()), "live");
    }

    private EscortSession load(UUID id) {
        return sessions.findById(id).orElseThrow(() -> new NotFoundException("Walk not found"));
    }

    private String name(UUID id) { return users.findById(id).map(User::displayName).orElse("Your friend"); }

    private SessionDto dto(EscortSession s) {
        return new SessionDto(s.getId(), s.getStatus().name(), s.getWalkerId(), name(s.getWalkerId()), s.getEscortId(),
                name(s.getEscortId()), s.getStartedAt(), s.isStationaryAlerted(), s.isLostAlerted());
    }
}
