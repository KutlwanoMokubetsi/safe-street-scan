package za.co.crimespot.suggestions;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import za.co.crimespot.auth.AuthUser;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Moderators only: suggestions never become public without one of these actions. */
@RestController
@RequestMapping("/api/suggestions")
@PreAuthorize("hasAnyRole('MODERATOR','ADMIN')")
public class SuggestionController {

    private final SuggestionService service;

    public SuggestionController(SuggestionService service) { this.service = service; }

    @GetMapping
    public List<SuggestionService.SuggestionDto> pending() { return service.pending(); }

    @PostMapping("/{id}/accept")
    public SuggestionService.SuggestionDto accept(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id,
                                                  @RequestBody(required = false) SuggestionService.Accept body) {
        return service.accept(me, id, body);
    }

    @PostMapping("/{id}/dismiss")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void dismiss(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) { service.dismiss(me, id); }

    /** Runs the pipeline now instead of waiting for the 30-minute schedule. */
    @PostMapping("/refresh")
    public Map<String, String> refresh() {
        Thread.startVirtualThread(service::run);
        return Map.of("status", "started");
    }
}
