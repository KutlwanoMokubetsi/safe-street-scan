package za.co.crimespot.account;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import za.co.crimespot.auth.AuthUser;
import za.co.crimespot.common.NotFoundException;
import za.co.crimespot.security.FieldCrypto;
import za.co.crimespot.user.User;
import za.co.crimespot.user.UserRepository;

import java.time.Instant;
import java.util.*;

/** POPIA rights in the app: download everything we hold about you, or delete your account. */
@RestController
@RequestMapping("/api/me")
public class AccountController {

    private static final Logger log = LoggerFactory.getLogger(AccountController.class);

    private final UserRepository users;
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final KeycloakAdminClient keycloak;

    public AccountController(UserRepository users, JdbcTemplate jdbc, ObjectMapper json, KeycloakAdminClient keycloak) {
        this.users = users;
        this.jdbc = jdbc;
        this.json = json;
        this.keycloak = keycloak;
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> export(@AuthenticationPrincipal AuthUser me) throws Exception {
        User u = users.findById(me.id()).orElseThrow(() -> new NotFoundException("User not found"));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("exportedAt", Instant.now().toString());
        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("email", u.getEmail());
        profile.put("name", u.getFullName());
        profile.put("phone", u.getPhone());
        profile.put("language", u.getLang());
        profile.put("friendCode", u.getFriendCode());
        profile.put("role", u.getRole().name());
        profile.put("homeArea", u.getHomeLat() == null ? null : Map.of("lat", u.getHomeLat(), "lng", u.getHomeLng(), "alertRadiusM", u.getAlertRadiusM()));
        profile.put("hasProfilePicture", u.getAvatarUrl() != null);
        profile.put("createdAt", String.valueOf(u.getCreatedAt()));
        out.put("profile", profile);
        out.put("emergencyCard", u.getEmergencyInfoJson() == null ? null : json.readTree(u.getEmergencyInfoJson()));
        out.put("reports", jdbc.queryForList("SELECT id, crime_type, description, location_name, latitude, longitude, occurred_at, status, created_at FROM crime_reports WHERE user_id = ? ORDER BY created_at", me.id()));
        out.put("comments", jdbc.queryForList("SELECT report_id, body, created_at FROM report_comments WHERE user_id = ? ORDER BY created_at", me.id()));
        out.put("confirmations", jdbc.queryForList("SELECT report_id, created_at FROM report_confirmations WHERE user_id = ?", me.id()));
        out.put("friends", jdbc.queryForList("""
                SELECT CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END AS friend_user_id, f.status, f.created_at
                FROM friendships f WHERE f.requester_id = ? OR f.addressee_id = ?""", me.id(), me.id(), me.id()));
        List<Map<String, Object>> alerts = new ArrayList<>();
        for (Map<String, Object> a : jdbc.queryForList("SELECT id, latitude, longitude, message, status, created_at, resolved_at FROM panic_alerts WHERE user_id = ? ORDER BY created_at", me.id())) {
            for (String k : List.of("latitude", "longitude", "message")) a.put(k, FieldCrypto.decrypt((String) a.get(k)));
            alerts.add(a);
        }
        out.put("sosAlerts", alerts);
        out.put("locationSharing", jdbc.queryForList("SELECT reason, started_at, expires_at, ended_at FROM location_shares WHERE user_id = ? ORDER BY started_at", me.id()));
        out.put("walks", jdbc.queryForList("SELECT status, created_at, started_at, ended_at, (walker_id = ?) AS i_was_walker FROM escort_sessions WHERE walker_id = ? OR escort_id = ?", me.id(), me.id(), me.id()));
        out.put("groups", jdbc.queryForList("SELECT g.name, m.role, m.sos_share, m.joined_at FROM watch_group_members m JOIN watch_groups g ON g.id = m.group_id WHERE m.user_id = ?", me.id()));
        out.put("outageReports", jdbc.queryForList("SELECT latitude, longitude, created_at, restored_at FROM outage_reports WHERE user_id = ?", me.id()));
        out.put("note", "Live positions are not kept after sharing ends, so none are included.");
        byte[] body = json.writerWithDefaultPrettyPrinter().writeValueAsBytes(out);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"crimespot-my-data.json\"").body(body);
    }

    /**
     * Deletes the sign-in account first, then all CrimeSpot data (reports, comments, alerts, friends, groups…
     * cascade from the users row). Doing it in this order means a failure can't leave a login without data
     * that would silently recreate an empty account.
     */
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@AuthenticationPrincipal AuthUser me) throws Exception {
        User u = users.findById(me.id()).orElseThrow(() -> new NotFoundException("User not found"));
        if (u.getKeycloakId() != null) {
            if (keycloak.configured()) {
                if (!keycloak.deleteUser(u.getKeycloakId())) throw new IllegalStateException("Couldn't delete the sign-in account");
            } else {
                log.warn("Keycloak admin client not configured: sign-in account {} must be removed manually", u.getKeycloakId());
            }
        }
        // Groups this person owns are handed to the longest-standing admin, or deleted if there is none.
        for (UUID gid : jdbc.queryForList("SELECT group_id FROM watch_group_members WHERE user_id = ? AND role = 'OWNER'", UUID.class, me.id())) {
            List<UUID> admins = jdbc.queryForList("SELECT user_id FROM watch_group_members WHERE group_id = ? AND role = 'ADMIN' ORDER BY joined_at LIMIT 1", UUID.class, gid);
            if (admins.isEmpty()) jdbc.update("DELETE FROM watch_groups WHERE id = ?", gid);
            else jdbc.update("UPDATE watch_group_members SET role = 'OWNER' WHERE group_id = ? AND user_id = ?", gid, admins.get(0));
        }
        jdbc.update("DELETE FROM users WHERE id = ?", me.id());
    }
}
