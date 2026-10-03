package za.co.crimespot.groups;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import za.co.crimespot.common.BadRequestException;
import za.co.crimespot.common.NotFoundException;
import za.co.crimespot.i18n.Messages;
import za.co.crimespot.moderation.ContentFilter;
import za.co.crimespot.push.NotificationService;
import za.co.crimespot.realtime.RealtimeHub;
import za.co.crimespot.user.User;
import za.co.crimespot.user.UserRepository;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;

/**
 * Neighbourhood watch, estate and CPF groups. Free plan: up to 100 members per group, 5 groups owned per person.
 * A paid ESTATE plan (bigger groups, dashboards) can later lift these limits via watch_groups.plan.
 */
@Service
public class GroupService {

    public static final int FREE_MEMBER_CAP = 100;
    private static final int MAX_OWNED = 5;
    private static final char[] CODE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Set<String> KINDS = Set.of("WATCH", "ESTATE", "CPF");

    public record GroupSummary(UUID id, String name, String kind, String role, int members, boolean sosShare) {}
    public record Member(UUID userId, String name, String avatarUrl, String role) {}
    public record Post(UUID id, String author, String body, boolean alert, Instant createdAt, boolean mine) {}
    public record Detail(UUID id, String name, String description, String kind, String plan, String inviteCode, Double areaLat,
                         Double areaLng, int areaRadiusM, String myRole, boolean mySosShare, int memberCap,
                         List<Member> members, List<Post> posts) {}

    private final JdbcTemplate jdbc;
    private final UserRepository users;
    private final ContentFilter filter;
    private final NotificationService notifications;
    private final RealtimeHub hub;

    public GroupService(JdbcTemplate jdbc, UserRepository users, ContentFilter filter, NotificationService notifications, RealtimeHub hub) {
        this.jdbc = jdbc;
        this.users = users;
        this.filter = filter;
        this.notifications = notifications;
        this.hub = hub;
    }

    public List<GroupSummary> mine(UUID me) {
        return jdbc.query("""
                SELECT g.id, g.name, g.kind, m.role, m.sos_share, (SELECT count(*) FROM watch_group_members x WHERE x.group_id = g.id) AS n
                FROM watch_groups g JOIN watch_group_members m ON m.group_id = g.id WHERE m.user_id = ? ORDER BY g.name""",
                (rs, i) -> new GroupSummary((UUID) rs.getObject("id"), rs.getString("name"), rs.getString("kind"), rs.getString("role"),
                        rs.getInt("n"), rs.getBoolean("sos_share")), me);
    }

    @Transactional
    public UUID create(UUID me, String name, String kind, String description, Double lat, Double lng) {
        if (name == null || name.isBlank() || name.length() > 80) throw new BadRequestException("Give the group a name (up to 80 characters).");
        if (!KINDS.contains(kind)) throw new BadRequestException("Choose watch, estate or CPF.");
        checkText(name);
        if (description != null) checkText(description);
        Integer owned = jdbc.queryForObject("SELECT count(*) FROM watch_group_members WHERE user_id = ? AND role = 'OWNER'", Integer.class, me);
        if (owned != null && owned >= MAX_OWNED) throw new BadRequestException("You can own up to " + MAX_OWNED + " groups.");
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO watch_groups (id, name, description, kind, invite_code, area_lat, area_lng, created_by) VALUES (?,?,?,?,?,?,?,?)",
                id, name.trim(), description == null || description.isBlank() ? null : description.trim(), kind, newCode(),
                lat == null ? null : Math.round(lat * 1000) / 1000.0, lng == null ? null : Math.round(lng * 1000) / 1000.0, me);
        jdbc.update("INSERT INTO watch_group_members (group_id, user_id, role) VALUES (?, ?, 'OWNER')", id, me);
        return id;
    }

    public Detail get(UUID me, UUID id) {
        String myRole = role(me, id);
        Map<String, Object> g = jdbc.queryForMap("SELECT * FROM watch_groups WHERE id = ?", id);
        boolean sos = Boolean.TRUE.equals(jdbc.queryForObject("SELECT sos_share FROM watch_group_members WHERE group_id = ? AND user_id = ?", Boolean.class, id, me));
        List<UUID> memberIds = new ArrayList<>();
        Map<UUID, String> roles = new LinkedHashMap<>();
        jdbc.query("SELECT user_id, role FROM watch_group_members WHERE group_id = ? ORDER BY CASE role WHEN 'OWNER' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END, joined_at",
                rs -> { UUID u = (UUID) rs.getObject(1); memberIds.add(u); roles.put(u, rs.getString(2)); }, id);
        Map<UUID, User> people = new HashMap<>();
        users.findAllById(memberIds).forEach(u -> people.put(u.getId(), u));
        List<Member> members = memberIds.stream().filter(people::containsKey)
                .map(u -> new Member(u, people.get(u).displayName(), people.get(u).getAvatarUrl(), roles.get(u))).toList();
        List<Post> posts = jdbc.query("SELECT id, user_id, body, is_alert, created_at FROM watch_group_posts WHERE group_id = ? ORDER BY created_at DESC LIMIT 50",
                (rs, i) -> {
                    UUID author = (UUID) rs.getObject("user_id");
                    User u = people.get(author);
                    return new Post((UUID) rs.getObject("id"), u == null ? "Former member" : u.displayName(), rs.getString("body"),
                            rs.getBoolean("is_alert"), rs.getTimestamp("created_at").toInstant(), author.equals(me));
                }, id);
        return new Detail(id, (String) g.get("name"), (String) g.get("description"), (String) g.get("kind"), (String) g.get("plan"),
                (String) g.get("invite_code"), (Double) g.get("area_lat"), (Double) g.get("area_lng"), ((Number) g.get("area_radius_m")).intValue(),
                myRole, sos, "FREE".equals(g.get("plan")) ? FREE_MEMBER_CAP : 0, members, posts);
    }

    @Transactional
    public UUID join(UUID me, String rawCode) {
        String code = rawCode == null ? "" : rawCode.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT id, plan FROM watch_groups WHERE invite_code = ?", code);
        if (rows.isEmpty()) throw new BadRequestException("No group has that code. Check it and try again.");
        UUID id = (UUID) rows.get(0).get("id");
        Integer n = jdbc.queryForObject("SELECT count(*) FROM watch_group_members WHERE group_id = ?", Integer.class, id);
        if ("FREE".equals(rows.get(0).get("plan")) && n != null && n >= FREE_MEMBER_CAP) {
            throw new BadRequestException("This group is full (" + FREE_MEMBER_CAP + " members on the free plan).");
        }
        jdbc.update("INSERT INTO watch_group_members (group_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING", id, me);
        hub.toUsers(memberIds(id), "groups");
        return id;
    }

    /** Leave (yourself) or remove someone (admins). Owners can't leave: they delete the group or hand it over first. */
    @Transactional
    public void removeMember(UUID me, UUID id, UUID userId) {
        String myRole = role(me, id);
        String theirRole = role(userId, id);
        boolean self = me.equals(userId);
        if (self && "OWNER".equals(myRole)) throw new BadRequestException("Make someone else the owner, or delete the group.");
        if (!self && !isAdmin(myRole)) throw new AccessDeniedException("Admins only");
        if (!self && "OWNER".equals(theirRole)) throw new AccessDeniedException("The owner can't be removed");
        List<UUID> before = memberIds(id);
        jdbc.update("DELETE FROM watch_group_members WHERE group_id = ? AND user_id = ?", id, userId);
        hub.toUsers(before, "groups");
    }

    @Transactional
    public void setRole(UUID me, UUID id, UUID userId, String newRole) {
        if (!"OWNER".equals(role(me, id))) throw new AccessDeniedException("Only the owner can change roles");
        role(userId, id);
        if ("OWNER".equals(newRole)) { // hand over ownership
            jdbc.update("UPDATE watch_group_members SET role = 'ADMIN' WHERE group_id = ? AND user_id = ?", id, me);
        } else if (!Set.of("ADMIN", "MEMBER").contains(newRole)) {
            throw new BadRequestException("Choose admin or member.");
        }
        jdbc.update("UPDATE watch_group_members SET role = ? WHERE group_id = ? AND user_id = ?", newRole, id, userId);
        hub.toUsers(memberIds(id), "groups");
    }

    @Transactional
    public void setSosShare(UUID me, UUID id, boolean share) {
        role(me, id);
        jdbc.update("UPDATE watch_group_members SET sos_share = ? WHERE group_id = ? AND user_id = ?", share, id, me);
    }

    @Transactional
    public void update(UUID me, UUID id, String name, String description, Double lat, Double lng, Integer radius) {
        if (!isAdmin(role(me, id))) throw new AccessDeniedException("Admins only");
        if (name != null && !name.isBlank()) { checkText(name); jdbc.update("UPDATE watch_groups SET name = ? WHERE id = ?", name.trim(), id); }
        if (description != null) { checkText(description); jdbc.update("UPDATE watch_groups SET description = ? WHERE id = ?", description.isBlank() ? null : description.trim(), id); }
        if (lat != null && lng != null) jdbc.update("UPDATE watch_groups SET area_lat = ?, area_lng = ? WHERE id = ?",
                Math.round(lat * 1000) / 1000.0, Math.round(lng * 1000) / 1000.0, id);
        if (radius != null) {
            if (radius < 300 || radius > 10_000) throw new BadRequestException("Choose an area between 300 m and 10 km.");
            jdbc.update("UPDATE watch_groups SET area_radius_m = ? WHERE id = ?", radius, id);
        }
        hub.toUsers(memberIds(id), "groups");
    }

    @Transactional
    public void delete(UUID me, UUID id) {
        if (!"OWNER".equals(role(me, id))) throw new AccessDeniedException("Only the owner can delete the group");
        List<UUID> before = memberIds(id);
        jdbc.update("DELETE FROM watch_groups WHERE id = ?", id);
        hub.toUsers(before, "groups");
    }

    /** Posts go through the same filter as comments. Alerts (admins only) notify every member. */
    @Transactional
    public void post(UUID me, UUID id, String body, boolean alert) {
        String myRole = role(me, id);
        if (alert && !isAdmin(myRole)) throw new AccessDeniedException("Only admins can send alerts");
        if (body == null || body.isBlank()) throw new BadRequestException("err.comment.empty");
        if (body.length() > 1000) throw new BadRequestException("err.comment.long");
        Integer recent = jdbc.queryForObject("SELECT count(*) FROM watch_group_posts WHERE user_id = ? AND created_at > now() - interval '10 minutes'", Integer.class, me);
        if (recent != null && recent >= 10) throw new BadRequestException("err.comment.rate");
        ContentFilter.Result check = filter.check(body);
        if (check.blocked()) throw new BadRequestException(check.reason());
        jdbc.update("INSERT INTO watch_group_posts (group_id, user_id, body, is_alert) VALUES (?, ?, ?, ?)", id, me, check.text(), alert);
        List<UUID> members = memberIds(id);
        hub.toUsers(members, "groups");
        if (alert) {
            String group = jdbc.queryForObject("SELECT name FROM watch_groups WHERE id = ?", String.class, id);
            List<UUID> others = members.stream().filter(u -> !u.equals(me)).toList();
            String text = check.text().length() > 140 ? check.text().substring(0, 137) + "…" : check.text();
            notifications.sendLocalized(others, l -> new String[] { Messages.t(l, "push.group.alert.title", Map.of("group", group)), text },
                    "/groups/" + id, true);
        }
    }

    @Transactional
    public void deletePost(UUID me, UUID id, UUID postId) {
        String myRole = role(me, id);
        List<UUID> author = jdbc.queryForList("SELECT user_id FROM watch_group_posts WHERE id = ? AND group_id = ?", UUID.class, postId, id);
        if (author.isEmpty()) throw new NotFoundException("Post not found");
        if (!author.get(0).equals(me) && !isAdmin(myRole)) throw new AccessDeniedException("Not your post");
        jdbc.update("DELETE FROM watch_group_posts WHERE id = ?", postId);
        hub.toUsers(memberIds(id), "groups");
    }

    // ---------- SOS integration ----------

    /** Members of every group where this person opted in to share their SOS. */
    public Set<UUID> sosAudience(UUID owner) {
        return new HashSet<>(jdbc.queryForList("""
                SELECT DISTINCT m.user_id FROM watch_group_members me
                JOIN watch_group_members m ON m.group_id = me.group_id
                WHERE me.user_id = ? AND me.sos_share = TRUE AND m.user_id <> ?""", UUID.class, owner, owner));
    }

    /** People whose SOS this viewer receives through a shared group. */
    public Set<UUID> sosSourcesFor(UUID viewer) {
        return new HashSet<>(jdbc.queryForList("""
                SELECT DISTINCT me.user_id FROM watch_group_members m
                JOIN watch_group_members me ON me.group_id = m.group_id
                WHERE m.user_id = ? AND me.sos_share = TRUE AND me.user_id <> ?""", UUID.class, viewer, viewer));
    }

    // ---------- helpers ----------

    private String role(UUID user, UUID group) {
        List<String> r = jdbc.queryForList("SELECT role FROM watch_group_members WHERE group_id = ? AND user_id = ?", String.class, group, user);
        if (r.isEmpty()) throw new NotFoundException("Group not found");
        return r.get(0);
    }

    private static boolean isAdmin(String role) { return "OWNER".equals(role) || "ADMIN".equals(role); }

    private List<UUID> memberIds(UUID group) {
        return jdbc.queryForList("SELECT user_id FROM watch_group_members WHERE group_id = ?", UUID.class, group);
    }

    private void checkText(String s) {
        ContentFilter.Result r = filter.check(s);
        if (r.blocked()) throw new BadRequestException(r.reason());
    }

    private String newCode() {
        for (int a = 0; a < 20; a++) {
            StringBuilder sb = new StringBuilder(8);
            for (int i = 0; i < 8; i++) sb.append(CODE[RANDOM.nextInt(CODE.length)]);
            Integer n = jdbc.queryForObject("SELECT count(*) FROM watch_groups WHERE invite_code = ?", Integer.class, sb.toString());
            if (n != null && n == 0) return sb.toString();
        }
        throw new IllegalStateException("Could not generate an invite code");
    }
}
