package za.co.crimespot.groups;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import za.co.crimespot.auth.AuthUser;
import za.co.crimespot.report.CrimeReport;
import za.co.crimespot.report.ReportDto;
import za.co.crimespot.report.ReportService;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/groups")
public class GroupController {

    private final GroupService groups;
    private final ReportService reports;

    public GroupController(GroupService groups, ReportService reports) {
        this.groups = groups;
        this.reports = reports;
    }

    public record Create(@NotBlank @Size(max = 80) String name, @NotBlank String kind, @Size(max = 500) String description, Double lat, Double lng) {}
    public record Join(@NotBlank @Size(max = 20) String code) {}
    public record Update(@Size(max = 80) String name, @Size(max = 500) String description, Double lat, Double lng, Integer radiusM) {}
    public record NewPost(@NotBlank @Size(max = 1000) String body, boolean alert) {}
    public record Role(@NotBlank String role) {}
    public record Sos(boolean share) {}

    @GetMapping
    public List<GroupService.GroupSummary> mine(@AuthenticationPrincipal AuthUser me) { return groups.mine(me.id()); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, UUID> create(@AuthenticationPrincipal AuthUser me, @RequestBody @Valid Create b) {
        return Map.of("id", groups.create(me.id(), b.name(), b.kind(), b.description(), b.lat(), b.lng()));
    }

    @PostMapping("/join")
    public Map<String, UUID> join(@AuthenticationPrincipal AuthUser me, @RequestBody @Valid Join b) {
        return Map.of("id", groups.join(me.id(), b.code()));
    }

    @GetMapping("/{id}")
    public GroupService.Detail get(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) { return groups.get(me.id(), id); }

    @PatchMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void update(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id, @RequestBody @Valid Update b) {
        groups.update(me.id(), id, b.name(), b.description(), b.lat(), b.lng(), b.radiusM());
    }

    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) { groups.delete(me.id(), id); }

    @DeleteMapping("/{id}/members/{userId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id, @PathVariable UUID userId) { groups.removeMember(me.id(), id, userId); }

    @PatchMapping("/{id}/members/{userId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void role(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id, @PathVariable UUID userId, @RequestBody @Valid Role b) {
        groups.setRole(me.id(), id, userId, b.role());
    }

    @PutMapping("/{id}/sos") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void sos(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id, @RequestBody Sos b) { groups.setSosShare(me.id(), id, b.share()); }

    @PostMapping("/{id}/posts") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void post(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id, @RequestBody @Valid NewPost b) {
        groups.post(me.id(), id, b.body(), b.alert());
    }

    @DeleteMapping("/{id}/posts/{postId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePost(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id, @PathVariable UUID postId) {
        groups.deletePost(me.id(), id, postId);
    }

    /** Reports in the group's area over the last 14 days. */
    @GetMapping("/{id}/reports")
    public List<ReportDto> areaReports(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        GroupService.Detail g = groups.get(me.id(), id);
        if (g.areaLat() == null || g.areaLng() == null) return List.of();
        double dLat = g.areaRadiusM() / 111_320.0, dLng = g.areaRadiusM() / (111_320.0 * Math.cos(Math.toRadians(g.areaLat())));
        List<CrimeReport> list = reports.inArea(g.areaLat() - dLat, g.areaLat() + dLat, g.areaLng() - dLng, g.areaLng() + dLng, 14, false);
        return list.stream().map(r -> ReportDto.from(r, me.id())).toList();
    }
}
