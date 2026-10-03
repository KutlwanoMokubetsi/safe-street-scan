package za.co.crimespot.report;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import za.co.crimespot.auth.AuthUser;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService service;
    private final TrustService trust;

    public ReportController(ReportService service, TrustService trust) {
        this.service = service;
        this.trust = trust;
    }

    /** Adds confirmation counts and the trusted-reporter badge in one query per list. */
    private List<ReportDto> enrich(List<CrimeReport> list, AuthUser me, boolean forModerator) {
        TrustService.Confirmations c = trust.confirmations(list.stream().map(CrimeReport::getId).toList(), me.id());
        return list.stream().map(r -> {
            TrustService.Level lvl = trust.level(r.getUserId());
            return ReportDto.from(r, me.id()).with(c.counts().getOrDefault(r.getId(), 0), c.mine().contains(r.getId()),
                    "USER".equals(r.getSource()) && lvl == TrustService.Level.TRUSTED, forModerator ? lvl.name() : null);
        }).toList();
    }

    @PostMapping("/{id}/confirm")
    public java.util.Map<String, Integer> confirm(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        return java.util.Map.of("confirmations", trust.confirm(me, id));
    }

    @DeleteMapping("/{id}/confirm")
    public java.util.Map<String, Integer> unconfirm(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        return java.util.Map.of("confirmations", trust.unconfirm(me, id));
    }

    public record CreateReportRequest(
            @NotNull CrimeType crimeType,
            @NotBlank @Size(min = 10, max = 2000) String description,
            @Size(max = 200) String locationName,
            @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
            @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude,
            @NotNull Instant occurredAt) {}

    public record ReviewRequest(@NotNull ReportStatus status) {}

    /** Reports inside a map bounding box. */
    @GetMapping
    public List<ReportDto> inArea(@AuthenticationPrincipal AuthUser me,
                                  @RequestParam double minLat, @RequestParam double maxLat,
                                  @RequestParam double minLng, @RequestParam double maxLng,
                                  @RequestParam(defaultValue = "30") int days,
                                  @RequestParam(defaultValue = "false") boolean verifiedOnly) {
        return enrich(service.inArea(minLat, maxLat, minLng, maxLng, days, verifiedOnly), me, false);
    }

    @GetMapping("/recent")
    public List<ReportDto> recent(@AuthenticationPrincipal AuthUser me,
                                  @RequestParam(defaultValue = "10") int limit) {
        return enrich(service.recent(limit), me, false);
    }

    @GetMapping("/{id}")
    public ReportDto one(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        return enrich(List.of(service.get(me, id)), me, me.canModerate()).get(0);
    }

    @GetMapping("/mine")
    public List<ReportDto> mine(@AuthenticationPrincipal AuthUser me) {
        return enrich(service.mine(me), me, false);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReportDto create(@AuthenticationPrincipal AuthUser me, @RequestBody @Valid CreateReportRequest req) {
        var cmd = new ReportService.CreateCommand(req.crimeType(), req.description(), req.locationName(),
                req.latitude(), req.longitude(), req.occurredAt());
        return ReportDto.from(service.create(me, cmd), me.id());
    }

    @GetMapping("/pending")
    @PreAuthorize("hasAnyRole('MODERATOR','ADMIN')")
    public List<ReportDto> pending(@AuthenticationPrincipal AuthUser me) {
        // Most-confirmed first, then trusted reporters: the likeliest genuine reports get reviewed first.
        return enrich(service.pendingQueue(), me, true).stream()
                .sorted(java.util.Comparator.comparingInt(ReportDto::confirmations).reversed()
                        .thenComparing(d -> !"TRUSTED".equals(d.reporterTrust())))
                .toList();
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('MODERATOR','ADMIN')")
    public ReportDto review(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id,
                            @RequestBody @Valid ReviewRequest req) {
        return ReportDto.from(service.review(me, id, req.status()), me.id());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        service.delete(me, id);
    }
}
