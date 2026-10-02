package za.co.crimespot.friends;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import za.co.crimespot.auth.AuthUser;

import java.util.UUID;

@RestController
@RequestMapping("/api/friends")
public class FriendController {

    private final FriendService service;

    public FriendController(FriendService service) { this.service = service; }

    public record FriendRequest(@NotBlank @Size(max = 20) String code) {}

    @GetMapping
    public FriendService.Overview list(@AuthenticationPrincipal AuthUser me) {
        return service.overview(me.id());
    }

    @PostMapping("/requests")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void request(@AuthenticationPrincipal AuthUser me, @RequestBody @Valid FriendRequest body) {
        service.request(me.id(), body.code());
    }

    @PostMapping("/requests/{id}/accept")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void accept(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        service.accept(me.id(), id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        service.remove(me.id(), id);
    }
}
