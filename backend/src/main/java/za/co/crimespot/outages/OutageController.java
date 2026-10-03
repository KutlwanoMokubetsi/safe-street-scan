package za.co.crimespot.outages;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import za.co.crimespot.auth.AuthUser;

@RestController
@RequestMapping("/api/outages")
public class OutageController {

    private final OutageService outages;

    public OutageController(OutageService outages) { this.outages = outages; }

    public record Out(@NotNull Double lat, @NotNull Double lng) {}

    @GetMapping
    public OutageService.Overview overview(@AuthenticationPrincipal AuthUser me) { return outages.overview(me.id()); }

    @PostMapping @ResponseStatus(HttpStatus.NO_CONTENT)
    public void out(@AuthenticationPrincipal AuthUser me, @RequestBody @Valid Out b) { outages.reportOut(me.id(), b.lat(), b.lng()); }

    @PostMapping("/restored") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void restored(@AuthenticationPrincipal AuthUser me) { outages.reportRestored(me.id()); }
}
