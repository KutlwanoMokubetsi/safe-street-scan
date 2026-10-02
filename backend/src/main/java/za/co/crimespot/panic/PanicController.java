package za.co.crimespot.panic;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import za.co.crimespot.auth.AuthUser;

import java.util.UUID;

@RestController
@RequestMapping("/api/panic")
public class PanicController {

    private final PanicService service;

    public PanicController(PanicService service) { this.service = service; }

    /** Location is optional: an alert must still go out if GPS is unavailable. */
    public record Trigger(
            @DecimalMin("-90") @DecimalMax("90") Double latitude,
            @DecimalMin("-180") @DecimalMax("180") Double longitude,
            Double accuracyM,
            @Size(max = 280) String message) {}

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AlertDto trigger(@AuthenticationPrincipal AuthUser me, @RequestBody @Valid Trigger body) {
        PanicAlert a = service.trigger(me.id(), body.latitude(), body.longitude(), body.accuracyM(), body.message());
        return service.toDto(me.id(), a);
    }

    @PostMapping("/{id}/resolve")
    public AlertDto resolve(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        return service.toDto(me.id(), service.resolve(me.id(), id));
    }

    @GetMapping("/{id}")
    public AlertDto get(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        return service.toDto(me.id(), service.loadFor(me.id(), id));
    }
}
