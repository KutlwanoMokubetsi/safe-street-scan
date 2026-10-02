package za.co.crimespot.user;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import za.co.crimespot.auth.AuthUser;
import za.co.crimespot.common.BadRequestException;

import java.io.IOException;
import java.io.InputStream;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@RestController
public class AvatarController {

    private final AvatarService avatars;

    public AvatarController(AvatarService avatars) { this.avatars = avatars; }

    /** Raw image body (image/jpeg or image/png). Read with a hard size cap, never fully trusted. */
    @PutMapping(value = "/api/me/avatar", consumes = { "image/jpeg", "image/png" })
    public Map<String, String> upload(@AuthenticationPrincipal AuthUser me, HttpServletRequest req) throws IOException {
        byte[] data;
        try (InputStream in = req.getInputStream()) {
            data = in.readNBytes(AvatarService.MAX_BYTES + 1);
        }
        if (data.length > AvatarService.MAX_BYTES) throw new BadRequestException("That picture is too large. Choose one under 3 MB.");
        return Map.of("avatarUrl", "/api/avatars/" + avatars.save(me.id(), data));
    }

    @DeleteMapping("/api/me/avatar")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@AuthenticationPrincipal AuthUser me) { avatars.remove(me.id()); }

    /**
     * Public by unguessable token (img tags can't send tokens). Only you and your friends are ever given the URL.
     * A new upload gets a new token, so the image can be cached forever.
     */
    @GetMapping("/api/avatars/{token}")
    public ResponseEntity<byte[]> get(@PathVariable String token) {
        byte[] img = avatars.load(token);
        if (img == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok().contentType(MediaType.IMAGE_JPEG)
                .cacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable())
                .header("X-Content-Type-Options", "nosniff")
                .header("Cross-Origin-Resource-Policy", "cross-origin")
                .body(img);
    }
}
