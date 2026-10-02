package za.co.crimespot.user;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.Objects;

/**
 * Maps a Keycloak token to a local user, creating or linking the account on first sign-in.
 * Roles live in this database (managed from the Review page), not in Keycloak.
 */
@Service
public class UserProvisioningService {

    // No 0/O/1/I so codes are easy to read out loud.
    private static final char[] CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository users;
    private final String adminEmail;

    public UserProvisioningService(UserRepository users, @Value("${app.admin.email:}") String adminEmail) {
        this.users = users;
        this.adminEmail = adminEmail.trim().toLowerCase();
    }

    public User fromToken(Jwt jwt) {
        try {
            return resolve(jwt);
        } catch (DataIntegrityViolationException race) {
            // Two first requests arrived at once; the other one created the row.
            return users.findByKeycloakId(jwt.getSubject()).orElseThrow(() -> race);
        }
    }

    private User resolve(Jwt jwt) {
        String sub = jwt.getSubject();
        String email = Objects.requireNonNullElse(jwt.getClaimAsString("email"), sub + "@users.crimespot").toLowerCase();
        boolean verified = Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified"));
        String name = jwt.getClaimAsString("name");

        User user = users.findByKeycloakId(sub).orElse(null);
        boolean changed = false;

        // Link an account that existed before Keycloak, but only on a verified email,
        // otherwise anyone could register with someone else's address and take it over.
        if (user == null && verified) {
            user = users.findByEmailIgnoreCase(email).filter(u -> u.getKeycloakId() == null).orElse(null);
            if (user != null) {
                user.setKeycloakId(sub);
                changed = true;
            }
        }

        if (user == null) {
            user = new User();
            user.setKeycloakId(sub);
            // An older, unlinked account may already use this address. Without a verified email
            // we must not take it over, so this account gets a placeholder until it's verified.
            user.setEmail(users.findByEmailIgnoreCase(email).isPresent() ? sub + "@users.crimespot" : email);
            user.setFullName(name);
            user.setFriendCode(newFriendCode());
            changed = true;
        } else {
            if (user.getFullName() == null && name != null) { user.setFullName(name); changed = true; }
            if (verified && !email.equals(user.getEmail()) && users.findByEmailIgnoreCase(email).isEmpty()) {
                user.setEmail(email);
                changed = true;
            }
        }

        if (verified && !adminEmail.isEmpty() && adminEmail.equals(email) && user.getRole() != Role.ADMIN) {
            user.setRole(Role.ADMIN);
            changed = true;
        }
        return changed || user.getId() == null ? users.save(user) : user;
    }

    private String newFriendCode() {
        for (int attempt = 0; attempt < 20; attempt++) {
            StringBuilder sb = new StringBuilder(8);
            for (int i = 0; i < 8; i++) sb.append(CODE_CHARS[RANDOM.nextInt(CODE_CHARS.length)]);
            String code = sb.toString();
            if (!users.existsByFriendCode(code)) return code;
        }
        throw new IllegalStateException("Could not generate a unique friend code");
    }
}
