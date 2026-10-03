package za.co.crimespot.escort;

import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import za.co.crimespot.auth.AuthUser;
import za.co.crimespot.panic.AlertDto;

import java.util.UUID;

@RestController
@RequestMapping("/api/escort")
public class EscortController {

    private final EscortService service;

    public EscortController(EscortService service) { this.service = service; }

    public record Request(@NotNull UUID friendId) {}

    @GetMapping
    public EscortService.Overview overview(@AuthenticationPrincipal AuthUser me) { return service.overview(me.id()); }

    @PostMapping
    public EscortService.SessionDto request(@AuthenticationPrincipal AuthUser me, @RequestBody @jakarta.validation.Valid Request body) {
        return service.request(me.id(), body.friendId());
    }

    @PostMapping("/{id}/accept")
    public EscortService.SessionDto accept(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) { return service.accept(me.id(), id); }

    @PostMapping("/{id}/decline") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void decline(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) { service.decline(me.id(), id); }

    @PostMapping("/{id}/end") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void end(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) { service.finish(me.id(), id); }

    @PostMapping("/{id}/ok") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void ok(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) { service.ok(me.id(), id); }

    @PostMapping("/{id}/alert")
    public AlertDto alert(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) { return service.raiseAlert(me.id(), id); }
}
