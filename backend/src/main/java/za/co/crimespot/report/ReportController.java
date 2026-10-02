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

    public ReportController(ReportService service) { this.service = service; }

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
        return service.inArea(minLat, maxLat, minLng, maxLng, days, verifiedOnly).stream()
                .map(r -> ReportDto.from(r, me.id())).toList();
    }

    @GetMapping("/recent")
    public List<ReportDto> recent(@AuthenticationPrincipal AuthUser me,
                                  @RequestParam(defaultValue = "10") int limit) {
        return service.recent(limit).stream().map(r -> ReportDto.from(r, me.id())).toList();
    }

    @GetMapping("/{id}")
    public ReportDto one(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        return ReportDto.from(service.get(me, id), me.id());
    }

    @GetMapping("/mine")
    public List<ReportDto> mine(@AuthenticationPrincipal AuthUser me) {
        return service.mine(me).stream().map(r -> ReportDto.from(r, me.id())).toList();
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
        return service.pendingQueue().stream().map(r -> ReportDto.from(r, me.id())).toList();
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
