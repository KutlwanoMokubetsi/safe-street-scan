package za.co.crimespot.push;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Sends notifications to the Android app through FCM HTTP v1. Uses the service account's key to sign a
 * short-lived JWT for an OAuth token, instead of the Firebase Admin SDK, which would add tens of MB to a
 * memory-tight server. Disabled until FIREBASE_CREDENTIALS is set.
 */
@Component
public class FcmSender {

    private static final Logger log = LoggerFactory.getLogger(FcmSender.class);
    private static final Base64.Encoder B64URL = Base64.getUrlEncoder().withoutPadding();

    private final ObjectMapper json;
    private final JdbcTemplate jdbc;
    private final String credentials;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final ReentrantLock tokenLock = new ReentrantLock();

    private String projectId, clientEmail, tokenUri;
    private PrivateKey key;
    private volatile String accessToken;
    private volatile long accessTokenExpiry;

    public FcmSender(ObjectMapper json, JdbcTemplate jdbc, @Value("${app.fcm.credentials:}") String credentials) {
        this.json = json;
        this.jdbc = jdbc;
        this.credentials = credentials;
    }

    @PostConstruct
    void init() {
        if (credentials.isBlank()) { log.info("FIREBASE_CREDENTIALS not set: Android app push is off"); return; }
        try {
            JsonNode c = json.readTree(credentials);
            projectId = c.path("project_id").asText();
            clientEmail = c.path("client_email").asText();
            tokenUri = c.path("token_uri").asText("https://oauth2.googleapis.com/token");
            String pem = c.path("private_key").asText().replaceAll("-----[A-Z ]+-----", "").replaceAll("\\s", "");
            key = KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(Base64.getDecoder().decode(pem)));
            log.info("Android app push enabled for Firebase project {}", projectId);
        } catch (Exception e) {
            key = null;
            log.error("Invalid FIREBASE_CREDENTIALS: Android app push is off", e);
        }
    }

    public boolean enabled() { return key != null; }

    /** Sends to every registered device of these users; tokens Firebase reports as gone are removed. */
    public void send(Collection<UUID> userIds, String title, String body, String url, boolean urgent) {
        if (!enabled() || userIds.isEmpty()) return;
        String in = String.join(",", Collections.nCopies(userIds.size(), "?"));
        List<String> tokens = jdbc.queryForList("SELECT token FROM device_tokens WHERE user_id IN (" + in + ")", String.class, userIds.toArray());
        if (tokens.isEmpty()) return;
        String bearer;
        try { bearer = token(); } catch (Exception e) { log.warn("FCM auth failed: {}", e.getMessage()); return; }
        for (String t : tokens) {
            try {
                Map<String, Object> msg = Map.of("message", Map.of(
                        "token", t,
                        "notification", Map.of("title", title, "body", body),
                        "data", Map.of("url", url, "urgent", String.valueOf(urgent)),
                        "android", Map.of("priority", urgent ? "high" : "normal",
                                "notification", Map.of("channel_id", urgent ? "sos" : "general", "tag", urgent ? "sos" : "crimespot"))));
                HttpResponse<String> res = http.send(HttpRequest.newBuilder(URI.create("https://fcm.googleapis.com/v1/projects/" + projectId + "/messages:send"))
                        .header("Authorization", "Bearer " + bearer).header("Content-Type", "application/json")
                        .timeout(Duration.ofSeconds(10)).POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(msg))).build(),
                        HttpResponse.BodyHandlers.ofString());
                if (res.statusCode() == 404 || (res.statusCode() == 400 && res.body().contains("registration token"))) {
                    jdbc.update("DELETE FROM device_tokens WHERE token = ?", t); // app uninstalled or token rotated
                } else if (res.statusCode() >= 400) {
                    log.warn("FCM send failed: HTTP {}", res.statusCode());
                }
            } catch (Exception e) {
                log.warn("FCM send failed: {}", e.getMessage());
            }
        }
    }

    /** OAuth access token from a self-signed JWT (RS256), cached until 5 minutes before it expires. */
    private String token() throws Exception {
        if (accessToken != null && System.currentTimeMillis() < accessTokenExpiry) return accessToken;
        tokenLock.lock();
        try {
            if (accessToken != null && System.currentTimeMillis() < accessTokenExpiry) return accessToken;
            long now = System.currentTimeMillis() / 1000;
            String header = B64URL.encodeToString("{\"alg\":\"RS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
            String claims = B64URL.encodeToString(json.writeValueAsBytes(Map.of(
                    "iss", clientEmail, "scope", "https://www.googleapis.com/auth/firebase.messaging",
                    "aud", tokenUri, "iat", now, "exp", now + 3600)));
            Signature sig = Signature.getInstance("SHA256withRSA");
            sig.initSign(key);
            sig.update((header + "." + claims).getBytes(StandardCharsets.UTF_8));
            String jwt = header + "." + claims + "." + B64URL.encodeToString(sig.sign());
            String form = "grant_type=" + URLEncoder.encode("urn:ietf:params:oauth:grant-type:jwt-bearer", StandardCharsets.UTF_8) + "&assertion=" + jwt;
            HttpResponse<String> res = http.send(HttpRequest.newBuilder(URI.create(tokenUri))
                    .header("Content-Type", "application/x-www-form-urlencoded").timeout(Duration.ofSeconds(10))
                    .POST(HttpRequest.BodyPublishers.ofString(form)).build(), HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() != 200) throw new IllegalStateException("token HTTP " + res.statusCode());
            JsonNode t = json.readTree(res.body());
            accessToken = t.path("access_token").asText();
            accessTokenExpiry = System.currentTimeMillis() + (t.path("expires_in").asLong(3600) - 300) * 1000;
            return accessToken;
        } finally {
            tokenLock.unlock();
        }
    }
}
