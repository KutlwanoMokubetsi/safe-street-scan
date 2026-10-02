package za.co.crimespot.auth;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import za.co.crimespot.user.Role;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** The authenticated principal placed in the security context. */
public record AuthUser(UUID id, String email, Role role) {
    public Collection<? extends GrantedAuthority> authorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }
    public boolean canModerate() {
        return role == Role.MODERATOR || role == Role.ADMIN;
    }
}
