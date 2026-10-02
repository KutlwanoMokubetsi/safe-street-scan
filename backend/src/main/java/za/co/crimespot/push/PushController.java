package za.co.crimespot.push;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import za.co.crimespot.auth.AuthUser;
import za.co.crimespot.security.FieldCrypto;

import java.util.Map;

@RestController
@RequestMapping("/api/push")
public class PushController {

    private final PushSubscriptionRepository subscriptions;
    private final NotificationService notifications;

    public PushController(PushSubscriptionRepository subscriptions, NotificationService notifications) {
        this.subscriptions = subscriptions;
        this.notifications = notifications;
    }

    public record Keys(@NotBlank @Size(max = 255) String p256dh, @NotBlank @Size(max = 255) String auth) {}
    public record Subscribe(@NotBlank @Size(max = 2000) String endpoint, @NotNull @Valid Keys keys) {}
    public record Unsubscribe(@NotBlank String endpoint) {}

    @GetMapping("/public-key")
    public Map<String, Object> publicKey() {
        return Map.of("enabled", notifications.enabled(), "publicKey", notifications.publicKey());
    }

    @PostMapping("/subscribe")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void subscribe(@AuthenticationPrincipal AuthUser me, @RequestBody @Valid Subscribe body) {
        // A device belongs to whoever signed in on it last. Keys are encrypted like other sensitive fields.
        subscriptions.upsert(me.id(), body.endpoint(),
                FieldCrypto.encrypt(body.keys().p256dh()), FieldCrypto.encrypt(body.keys().auth()));
    }

    @PostMapping("/unsubscribe")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unsubscribe(@AuthenticationPrincipal AuthUser me, @RequestBody @Valid Unsubscribe body) {
        subscriptions.deleteByEndpointAndUserId(body.endpoint(), me.id());
    }
}
