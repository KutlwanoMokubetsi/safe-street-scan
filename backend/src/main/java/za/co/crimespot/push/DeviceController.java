package za.co.crimespot.push;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import za.co.crimespot.auth.AuthUser;

/** The Android app registers its FCM token here after sign-in, and removes it on sign-out. */
@RestController
@RequestMapping("/api/devices")
public class DeviceController {

    private final JdbcTemplate jdbc;

    public DeviceController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record Device(@NotBlank @Size(max = 4096) String token, @Pattern(regexp = "^(android|ios)$") String platform) {}

    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void register(@AuthenticationPrincipal AuthUser me, @RequestBody @Valid Device d) {
        // A device belongs to whoever signed in on it last.
        jdbc.update("""
                INSERT INTO device_tokens (user_id, token, platform) VALUES (?, ?, ?)
                ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform""",
                me.id(), d.token(), d.platform() == null ? "android" : d.platform());
    }

    @PostMapping("/remove")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@AuthenticationPrincipal AuthUser me, @RequestBody @Valid Device d) {
        jdbc.update("DELETE FROM device_tokens WHERE token = ? AND user_id = ?", d.token(), me.id());
    }
}
