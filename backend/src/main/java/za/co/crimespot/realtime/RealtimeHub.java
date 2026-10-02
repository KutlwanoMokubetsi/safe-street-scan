package za.co.crimespot.realtime;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import za.co.crimespot.user.UserProvisioningService;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Pushes small "something changed" events to signed-in apps over WebSocket.
 * Events carry no private data: the app re-fetches through the normal, access-checked API.
 *
 * Protocol (JSON text frames):
 *   client → {"type":"auth","token":"<Keycloak access token>"}  (first message, and again after each token refresh)
 *   client → {"type":"ping"}                                     server → {"type":"pong"}
 *   server → {"type":"ready"} | {"type":"live"} | {"type":"reports"} | {"type":"hotspots"} | {"type":"friends"}
 *   server → {"type":"notice","text":"..."}                       (short message to show as a toast)
 */
@Component
public class RealtimeHub extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(RealtimeHub.class);
    private static final long AUTH_DEADLINE_MS = 10_000;
    private static final int MAX_SESSIONS_PER_USER = 5;

    private static final class Conn {
        final WebSocketSession session;
        final long openedAt = System.currentTimeMillis();
        volatile UUID userId;
        volatile Instant expiresAt;
        Conn(WebSocketSession s) { this.session = s; }
    }

    private final Map<String, Conn> conns = new ConcurrentHashMap<>();
    private final Map<UUID, Set<String>> byUser = new ConcurrentHashMap<>();
    private final JwtDecoder jwtDecoder;
    private final UserProvisioningService provisioning;
    private final ObjectMapper json;
    private final za.co.crimespot.common.ReadCache cache;

    public RealtimeHub(JwtDecoder jwtDecoder, UserProvisioningService provisioning, ObjectMapper json,
                       za.co.crimespot.common.ReadCache cache) {
        this.jwtDecoder = jwtDecoder;
        this.provisioning = provisioning;
        this.json = json;
        this.cache = cache;
    }

    // ---------- publishing (called from services) ----------

    public void toUsers(Collection<UUID> users, String type) { afterCommit(() -> sendTo(users, msg(type, null))); }

    public void toAll(String type) {
        afterCommit(() -> {
            cache.invalidate(type);
            String m = msg(type, null);
            conns.values().forEach(c -> { if (c.userId != null) send(c, m); });
        });
    }

    public int connectedCount() { return (int) conns.values().stream().filter(c -> c.userId != null).count(); }

    public void notice(Collection<UUID> users, String text) { afterCommit(() -> sendTo(users, msg("notice", text))); }

    /** Only send once the database change is committed, so a client that re-fetches sees it. */
    private void afterCommit(Runnable r) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { r.run(); }
            });
        } else {
            r.run();
        }
    }

    private void sendTo(Collection<UUID> users, String text) {
        for (UUID u : new HashSet<>(users)) {
            for (String id : byUser.getOrDefault(u, Set.of())) {
                Conn c = conns.get(id);
                if (c != null) send(c, text);
            }
        }
    }

    private String msg(String type, String text) {
        try {
            Map<String, String> m = new LinkedHashMap<>();
            m.put("type", type);
            if (text != null) m.put("text", text);
            return json.writeValueAsString(m);
        } catch (Exception e) {
            return "{\"type\":\"" + type + "\"}";
        }
    }

    private void send(Conn c, String text) {
        try {
            if (c.session.isOpen()) c.session.sendMessage(new TextMessage(text));
        } catch (Exception e) {
            log.debug("WebSocket send failed: {}", e.getMessage());
        }
    }

    // ---------- connection lifecycle ----------

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        conns.put(session.getId(), new Conn(new ConcurrentWebSocketSessionDecorator(session, 5_000, 64 * 1024)));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        Conn c = conns.get(session.getId());
        if (c == null || message.getPayloadLength() > 8_192) { session.close(CloseStatus.POLICY_VIOLATION); return; }

        JsonNode node = json.readTree(message.getPayload());
        String type = node.path("type").asText();
        if ("ping".equals(type)) { send(c, msg("pong", null)); return; }
        if (!"auth".equals(type)) return;

        Jwt jwt;
        try {
            jwt = jwtDecoder.decode(node.path("token").asText());
        } catch (Exception e) {
            c.session.close(new CloseStatus(4401, "Invalid token"));
            return;
        }
        UUID userId = provisioning.fromToken(jwt).getId();
        if (c.userId != null && !c.userId.equals(userId)) { c.session.close(new CloseStatus(4401, "User changed")); return; }

        Set<String> mine = byUser.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet());
        if (c.userId == null && mine.size() >= MAX_SESSIONS_PER_USER) {
            c.session.close(new CloseStatus(4429, "Too many connections"));
            return;
        }
        c.expiresAt = jwt.getExpiresAt();
        if (c.userId == null) {
            c.userId = userId;
            mine.add(session.getId());
            send(c, msg("ready", null));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Conn c = conns.remove(session.getId());
        if (c != null && c.userId != null) {
            Set<String> mine = byUser.get(c.userId);
            if (mine != null) { mine.remove(session.getId()); if (mine.isEmpty()) byUser.remove(c.userId); }
        }
    }

    /** Drops connections that never signed in, or whose token expired without a refresh. */
    @Scheduled(fixedDelay = 15_000)
    void sweep() {
        long now = System.currentTimeMillis();
        for (Conn c : conns.values()) {
            boolean unauthLate = c.userId == null && now - c.openedAt > AUTH_DEADLINE_MS;
            boolean expired = c.expiresAt != null && c.expiresAt.toEpochMilli() + 60_000 < now;
            if (unauthLate || expired) {
                try { c.session.close(new CloseStatus(4401, "Authentication required")); } catch (Exception ignored) { }
            }
        }
    }
}
