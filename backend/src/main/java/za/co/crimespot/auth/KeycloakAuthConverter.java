package za.co.crimespot.auth;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import za.co.crimespot.user.User;
import za.co.crimespot.user.UserProvisioningService;

@Component
public class KeycloakAuthConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final UserProvisioningService provisioning;

    public KeycloakAuthConverter(UserProvisioningService provisioning) { this.provisioning = provisioning; }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        User u = provisioning.fromToken(jwt);
        return new AuthUserToken(new AuthUser(u.getId(), u.getEmail(), u.getRole()), jwt);
    }
}
