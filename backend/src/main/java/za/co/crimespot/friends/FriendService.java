package za.co.crimespot.friends;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import za.co.crimespot.common.BadRequestException;
import za.co.crimespot.common.NotFoundException;
import za.co.crimespot.location.LocationService;
import za.co.crimespot.push.NotificationService;
import za.co.crimespot.user.User;
import za.co.crimespot.user.UserRepository;

import java.time.Instant;
import java.util.*;

@Service
public class FriendService {

    private static final int MAX_FRIENDS = 50;

    private final FriendshipRepository friendships;
    private final UserRepository users;
    private final LocationService locations;
    private final NotificationService notifications;
    private final za.co.crimespot.realtime.RealtimeHub hub;

    public FriendService(FriendshipRepository friendships, UserRepository users,
                         LocationService locations, NotificationService notifications,
                         za.co.crimespot.realtime.RealtimeHub hub) {
        this.friendships = friendships;
        this.users = users;
        this.locations = locations;
        this.notifications = notifications;
        this.hub = hub;
    }

    public record Person(UUID userId, String name, String phone, String avatarUrl) {}
    public record Entry(UUID friendshipId, Person person, Instant since) {}
    public record Overview(String myCode, List<Entry> friends, List<Entry> incoming, List<Entry> outgoing) {}

    public Overview overview(UUID me) {
        User self = users.findById(me).orElseThrow(() -> new NotFoundException("User not found"));
        List<Friendship> all = friendships.findAllFor(me);
        Map<UUID, User> people = new HashMap<>();
        users.findAllById(all.stream().map(f -> f.otherThan(me)).toList()).forEach(u -> people.put(u.getId(), u));

        List<Entry> friends = new ArrayList<>(), incoming = new ArrayList<>(), outgoing = new ArrayList<>();
        for (Friendship f : all) {
            User other = people.get(f.otherThan(me));
            if (other == null) continue;
            boolean accepted = f.getStatus() == FriendshipStatus.ACCEPTED;
            // Phone numbers are only shared between accepted friends.
            // Phone numbers and pictures are only shared between accepted friends.
            Person p = new Person(other.getId(), other.displayName(), accepted ? other.getPhone() : null,
                    accepted ? other.getAvatarUrl() : null);
            if (accepted) friends.add(new Entry(f.getId(), p, f.getRespondedAt()));
            else if (f.getAddresseeId().equals(me)) incoming.add(new Entry(f.getId(), p, f.getCreatedAt()));
            else outgoing.add(new Entry(f.getId(), p, f.getCreatedAt()));
        }
        friends.sort(Comparator.comparing(e -> e.person().name().toLowerCase()));
        return new Overview(self.getFriendCode(), friends, incoming, outgoing);
    }

    @Transactional
    public void request(UUID me, String rawCode) {
        String code = rawCode == null ? "" : rawCode.trim().toUpperCase().replaceAll("[^A-Z0-9]", "");
        User target = users.findByFriendCode(code)
                .orElseThrow(() -> new BadRequestException("No one has that code. Check it and try again."));
        if (target.getId().equals(me)) throw new BadRequestException("That's your own code.");
        if (friendships.friendIdsOf(me).size() >= MAX_FRIENDS) {
            throw new BadRequestException("You've reached the limit of " + MAX_FRIENDS + " friends.");
        }

        Optional<Friendship> existing = friendships.findBetween(me, target.getId());
        if (existing.isPresent()) {
            Friendship f = existing.get();
            if (f.getStatus() == FriendshipStatus.ACCEPTED) throw new BadRequestException("You're already friends.");
            if (f.getRequesterId().equals(me)) throw new BadRequestException("Request already sent.");
            accept(me, f.getId()); // They had already asked you: adding them back accepts.
            return;
        }
        Friendship f = new Friendship();
        f.setRequesterId(me);
        f.setAddresseeId(target.getId());
        friendships.save(f);

        String name = users.findById(me).map(User::displayName).orElse("Someone");
        var p = Map.of("name", name);
        notifications.sendLocalized(List.of(target.getId()), l -> new String[] {
                za.co.crimespot.i18n.Messages.t(l, "push.friendReq.title"), za.co.crimespot.i18n.Messages.t(l, "push.friendReq.body", p) }, "/friends", false);
        hub.toUsers(List.of(me, target.getId()), "friends");
        hub.noticeLocalized(List.of(target.getId()), l -> za.co.crimespot.i18n.Messages.t(l, "push.friendReq.body", p));
    }

    @Transactional
    public void accept(UUID me, UUID friendshipId) {
        Friendship f = load(friendshipId);
        if (!f.getAddresseeId().equals(me) || f.getStatus() != FriendshipStatus.PENDING) {
            throw new AccessDeniedException("You can't accept this request");
        }
        f.setStatus(FriendshipStatus.ACCEPTED);
        f.setRespondedAt(Instant.now());
        friendships.save(f);
        String name = users.findById(me).map(User::displayName).orElse("Someone");
        var p = Map.of("name", name);
        notifications.sendLocalized(List.of(f.getRequesterId()), l -> new String[] {
                za.co.crimespot.i18n.Messages.t(l, "push.friendAcc.title"), za.co.crimespot.i18n.Messages.t(l, "push.friendAcc.body", p) }, "/friends", false);
        hub.toUsers(List.of(me, f.getRequesterId()), "friends");
        hub.noticeLocalized(List.of(f.getRequesterId()), l -> za.co.crimespot.i18n.Messages.t(l, "push.friendAcc.body", p));
    }

    /** Declines a request, cancels one you sent, or removes a friend. Also stops location sharing both ways. */
    @Transactional
    public void remove(UUID me, UUID friendshipId) {
        Friendship f = load(friendshipId);
        if (!f.involves(me)) throw new AccessDeniedException("Not your friendship");
        UUID other = f.otherThan(me);
        friendships.delete(f);
        locations.removeViewer(me, other);
        locations.removeViewer(other, me);
        hub.toUsers(List.of(me, other), "friends");
    }

    public boolean areFriends(UUID a, UUID b) {
        return friendships.findBetween(a, b).map(f -> f.getStatus() == FriendshipStatus.ACCEPTED).orElse(false);
    }

    public List<UUID> friendIds(UUID me) { return friendships.friendIdsOf(me); }

    private Friendship load(UUID id) {
        return friendships.findById(id).orElseThrow(() -> new NotFoundException("Friend request not found"));
    }
}
