package za.co.crimespot.account;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * Deletes sign-in accounts in Keycloak with a service-account client (client credentials grant).
 * Needs KEYCLOAK_ADMIN_CLIENT_ID / KEYCLOAK_ADMIN_CLIENT_SECRET for a confidential client whose service account
 * has the realm-management "manage-users" role.
 */
@Component
public class KeycloakAdminClient {

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final ObjectMapper json;
    private final String issuer, clientId, secret;

    public KeycloakAdminClient(ObjectMapper json, @Value("${app.auth.issuer}") String issuer,
                               @Value("${app.auth.admin-client-id:}") String clientId,
                               @Value("${app.auth.admin-client-secret:}") String secret) {
        this.json = json;
        this.issuer = issuer.endsWith("/") ? issuer.substring(0, issuer.length() - 1) : issuer;
        this.clientId = clientId;
        this.secret = secret;
    }

    public boolean configured() { return !clientId.isBlank() && !secret.isBlank(); }

    /** True if the account is gone (deleted now, or already absent). */
    public boolean deleteUser(String keycloakId) throws Exception {
        String form = "grant_type=client_credentials&client_id=" + URLEncoder.encode(clientId, StandardCharsets.UTF_8)
                + "&client_secret=" + URLEncoder.encode(secret, StandardCharsets.UTF_8);
        HttpResponse<String> tok = http.send(HttpRequest.newBuilder(URI.create(issuer + "/protocol/openid-connect/token"))
                .header("Content-Type", "application/x-www-form-urlencoded").timeout(Duration.ofSeconds(10))
                .POST(HttpRequest.BodyPublishers.ofString(form)).build(), HttpResponse.BodyHandlers.ofString());
        if (tok.statusCode() != 200) throw new IllegalStateException("Keycloak token HTTP " + tok.statusCode());
        String access = json.readTree(tok.body()).path("access_token").asText();

        // issuer = https://host/realms/<realm>  →  admin API = https://host/admin/realms/<realm>
        String admin = issuer.replace("/realms/", "/admin/realms/");
        HttpResponse<String> del = http.send(HttpRequest.newBuilder(URI.create(admin + "/users/" + URLEncoder.encode(keycloakId, StandardCharsets.UTF_8)))
                .header("Authorization", "Bearer " + access).timeout(Duration.ofSeconds(10)).DELETE().build(), HttpResponse.BodyHandlers.ofString());
        return del.statusCode() == 204 || del.statusCode() == 404;
    }
}
