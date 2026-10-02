package za.co.crimespot.comments;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import za.co.crimespot.auth.AuthUser;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class CommentController {

    private final CommentService service;

    public CommentController(CommentService service) { this.service = service; }

    public record NewComment(@NotNull @Size(max = 1000) String body) {}
    public record StatusChange(@NotNull Comment.Status status) {}

    @GetMapping("/reports/{id}/comments")
    public List<CommentService.CommentDto> list(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        return service.list(me, id);
    }

    @PostMapping("/reports/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public CommentService.PostResult post(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id, @RequestBody @Valid NewComment body) {
        return service.post(me, id, body.body());
    }

    @PostMapping("/comments/{id}/flag")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void flag(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) { service.flag(me, id); }

    @DeleteMapping("/comments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) { service.delete(me, id); }

    @PatchMapping("/comments/{id}")
    @PreAuthorize("hasAnyRole('MODERATOR','ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void setStatus(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id, @RequestBody @Valid StatusChange body) {
        service.setStatus(me, id, body.status());
    }

    @GetMapping("/comments/hidden")
    @PreAuthorize("hasAnyRole('MODERATOR','ADMIN')")
    public List<Map<String, Object>> hidden() { return service.hidden(); }
}
