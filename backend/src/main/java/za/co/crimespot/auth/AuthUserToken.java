package za.co.crimespot.auth;

import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.oauth2.jwt.Jwt;

/** Authentication whose principal is our {@link AuthUser}, so controllers can use @AuthenticationPrincipal AuthUser. */
public class AuthUserToken extends AbstractAuthenticationToken {

    private final AuthUser principal;
    private final Jwt jwt;

    public AuthUserToken(AuthUser principal, Jwt jwt) {
        super(principal.authorities());
        this.principal = principal;
        this.jwt = jwt;
        setAuthenticated(true);
    }

    @Override public AuthUser getPrincipal() { return principal; }
    @Override public Jwt getCredentials() { return jwt; }
    @Override public String getName() { return principal.id().toString(); }
}
