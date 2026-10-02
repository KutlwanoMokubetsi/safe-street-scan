package za.co.crimespot.user;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import za.co.crimespot.auth.AuthUser;
import za.co.crimespot.common.NotFoundException;

@RestController
@RequestMapping("/api/me")
public class MeController {

    private final UserRepository users;

    public MeController(UserRepository users) { this.users = users; }

    public record ProfileUpdate(
            @Size(max = 120) String fullName,
            @Size(max = 30) @Pattern(regexp = "^$|^[+0-9 ()-]{7,30}$", message = "must be a phone number") String phone) {}

    @GetMapping
    public UserDto me(@AuthenticationPrincipal AuthUser me) {
        return UserDto.from(load(me));
    }

    @PatchMapping
    public UserDto update(@AuthenticationPrincipal AuthUser me, @RequestBody @Valid ProfileUpdate body) {
        User u = load(me);
        if (body.fullName() != null) u.setFullName(body.fullName().isBlank() ? null : body.fullName().trim());
        if (body.phone() != null) u.setPhone(body.phone().isBlank() ? null : body.phone().trim());
        return UserDto.from(users.save(u));
    }

    private User load(AuthUser me) {
        return users.findById(me.id()).orElseThrow(() -> new NotFoundException("User not found"));
    }
}
