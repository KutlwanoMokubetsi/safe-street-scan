package za.co.crimespot.push;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import nl.martijndwars.webpush.Encoding;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.apache.http.HttpResponse;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.security.Security;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Sends Web Push notifications. Does nothing if VAPID keys are not configured. */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final PushSubscriptionRepository subscriptions;
    private final za.co.crimespot.i18n.Localizer localizer;
    private final FcmSender fcm;
    private final ObjectMapper json;
    private final String publicKey;
    private final String privateKey;
    private final String subject;
    private PushService push;

    public NotificationService(PushSubscriptionRepository subscriptions, ObjectMapper json, za.co.crimespot.i18n.Localizer localizer, FcmSender fcm,
                               @Value("${app.push.public-key:}") String publicKey,
                               @Value("${app.push.private-key:}") String privateKey,
                               @Value("${app.push.subject}") String subject) {
        this.subscriptions = subscriptions;
        this.localizer = localizer;
        this.fcm = fcm;
        this.json = json;
        this.publicKey = publicKey;
        this.privateKey = privateKey;
        this.subject = subject;
    }

    @PostConstruct
    void init() {
        if (publicKey.isBlank() || privateKey.isBlank()) {
            log.warn("VAPID keys not set: push notifications are disabled");
            return;
        }
        try {
            if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
                Security.addProvider(new BouncyCastleProvider());
            }
            PushService svc = new PushService();
            svc.setPublicKey(publicKey);
            svc.setPrivateKey(privateKey);
            svc.setSubject(subject);
            push = svc;
        } catch (Exception e) {
            log.error("Invalid VAPID keys: push notifications are disabled", e);
        }
    }

    public boolean enabled() { return push != null; }

    public String publicKey() { return publicKey; }

    /** Title and body built per recipient language: compose.apply(lang) returns {title, body}. */
    @Async
    public void sendLocalized(Collection<UUID> userIds, java.util.function.Function<String, String[]> compose, String url, boolean urgent) {
        if ((push == null && !fcm.enabled()) || userIds.isEmpty()) return;
        localizer.byLang(userIds).forEach((lang, users) -> {
            String[] tb = compose.apply(lang);
            deliver(users, tb[0], tb[1], url, urgent);
        });
    }

    @Async
    public void send(UUID userId, String title, String body, String url) {
        deliver(List.of(userId), title, body, url, false);
    }

    /**
     * Sends to every device of every user. Urgent notifications stay on screen until
     * dismissed and vibrate in a distinct pattern.
     */
    @Async
    public void sendToAll(Collection<UUID> userIds, String title, String body, String url, boolean urgent) {
        deliver(userIds, title, body, url, urgent);
    }

    private void deliver(Collection<UUID> userIds, String title, String body, String url, boolean urgent) {
        if (userIds.isEmpty()) return;
        fcm.send(userIds, title, body, url, urgent); // Android app
        if (push == null) return;                    // web push (browsers / installed PWA)
        String payload;
        try {
            // Format understood by Angular's service worker (ngsw).
            payload = json.writeValueAsString(Map.of("notification", Map.of(
                    "title", title,
                    "body", body,
                    "icon", "icons/icon-192x192.png",
                    "badge", "icons/icon-72x72.png",
                    "tag", urgent ? "panic" : "crimespot",
                    "renotify", urgent,
                    "requireInteraction", urgent,
                    "vibrate", urgent ? List.of(500, 200, 500, 200, 500) : List.of(100),
                    "data", Map.of("onActionClick", Map.of("default",
                            Map.of("operation", "navigateLastFocusedOrOpen", "url", url))))));
        } catch (Exception e) {
            log.error("Could not build push payload", e);
            return;
        }

        for (PushSubscription s : subscriptions.findByUserIdIn(userIds)) {
            try {
                Notification n = new Notification(s.getEndpoint(), s.getP256dh(), s.getAuth(), payload);
                HttpResponse res = push.send(n, Encoding.AES128GCM);
                int status = res.getStatusLine().getStatusCode();
                if (status == 404 || status == 410) {
                    subscriptions.deleteByEndpoint(s.getEndpoint()); // Device unsubscribed or app removed.
                } else if (status >= 400) {
                    log.warn("Push to {} failed with HTTP {}", s.getUserId(), status);
                }
            } catch (Exception e) {
                log.warn("Push to {} failed: {}", s.getUserId(), e.getMessage());
            }
        }
    }
}
