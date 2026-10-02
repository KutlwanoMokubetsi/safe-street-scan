package za.co.crimespot.location;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import za.co.crimespot.auth.AuthUser;
import za.co.crimespot.panic.AlertDto;
import za.co.crimespot.panic.PanicService;
import za.co.crimespot.user.User;
import za.co.crimespot.user.UserRepository;

import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api")
public class LocationController {

    private final LocationService locations;
    private final PanicService panic;
    private final UserRepository users;

    public LocationController(LocationService locations, PanicService panic, UserRepository users) {
        this.locations = locations;
        this.panic = panic;
        this.users = users;
    }

    public record StartShare(Integer minutes, List<UUID> friendIds, Integer checkInMinutes) {}

    public record Position(@NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
                           @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude,
                           Double accuracyM) {}

    public record ShareDto(UUID id, ShareReason reason, Instant startedAt, Instant expiresAt, Set<UUID> viewerIds,
                           Instant checkinDueAt) {
        static ShareDto from(LocationShare s) {
            return new ShareDto(s.getId(), s.getReason(), s.getStartedAt(), s.getExpiresAt(), s.getViewers(),
                    s.getCheckinDueAt());
        }
    }

    public record LiveFriend(UUID userId, String name, String phone, ShareReason reason, Instant expiresAt,
                             Double latitude, Double longitude, Double accuracyM, Instant updatedAt) {}

    public record Live(boolean sharing, ShareDto myShare, AlertDto myAlert,
                       List<LiveFriend> friends, List<AlertDto> alerts) {}

    @PostMapping("/location/share")
    @ResponseStatus(HttpStatus.CREATED)
    public ShareDto start(@AuthenticationPrincipal AuthUser me, @RequestBody StartShare body) {
        return ShareDto.from(locations.startManual(me.id(), body.minutes(), body.friendIds(), body.checkInMinutes()));
    }

    @DeleteMapping("/location/share")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void stop(@AuthenticationPrincipal AuthUser me) {
        locations.stop(me.id(), ShareReason.MANUAL);
    }

    @PostMapping("/location/checkin")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void checkIn(@AuthenticationPrincipal AuthUser me) {
        locations.checkIn(me.id());
    }

    @PostMapping("/location")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void update(@AuthenticationPrincipal AuthUser me, @RequestBody @Valid Position p) {
        locations.update(me.id(), p.latitude(), p.longitude(), p.accuracyM());
    }

    /** Everything the app polls for: my sharing state, friends I can see, and friends' active alerts. */
    @GetMapping("/live")
    public Live live(@AuthenticationPrincipal AuthUser me) {
        UUID id = me.id();

        Map<UUID, LocationShare> byOwner = new LinkedHashMap<>();
        for (LocationShare s : locations.visibleTo(id)) {
            // Prefer a panic share over a manual one for the same person.
            byOwner.merge(s.getUserId(), s, (a, b) -> a.getReason() == ShareReason.PANIC ? a : b);
        }
        Map<UUID, User> people = new HashMap<>();
        users.findAllById(byOwner.keySet()).forEach(u -> people.put(u.getId(), u));

        List<LiveFriend> friends = new ArrayList<>();
        for (LocationShare s : byOwner.values()) {
            User u = people.get(s.getUserId());
            if (u == null) continue;
            var loc = locations.location(u.getId()).orElse(null);
            friends.add(new LiveFriend(u.getId(), u.displayName(), u.getPhone(), s.getReason(), s.getExpiresAt(),
                    loc == null ? null : loc.getLatitude(), loc == null ? null : loc.getLongitude(),
                    loc == null ? null : loc.getAccuracyM(), loc == null ? null : loc.getUpdatedAt()));
        }

        return new Live(
                locations.isSharing(id),
                locations.active(id, ShareReason.MANUAL).map(ShareDto::from).orElse(null),
                panic.activeFor(id).map(a -> panic.toDto(id, a)).orElse(null),
                friends,
                panic.activeAmongFriends(id).stream().map(a -> panic.toDto(id, a)).toList());
    }
}
