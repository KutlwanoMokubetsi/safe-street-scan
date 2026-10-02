package za.co.crimespot.user;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import za.co.crimespot.common.NotFoundException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final UserRepository users;

    public AdminController(UserRepository users) { this.users = users; }

    public record RoleUpdate(@NotNull Role role) {}

    @GetMapping
    public List<UserDto> list() {
        return users.findAll(Sort.by("createdAt").descending()).stream().map(UserDto::from).toList();
    }

    @PatchMapping("/{id}/role")
    public UserDto setRole(@PathVariable UUID id, @RequestBody @Valid RoleUpdate body) {
        User u = users.findById(id).orElseThrow(() -> new NotFoundException("User not found"));
        u.setRole(body.role());
        return UserDto.from(users.save(u));
    }
}
