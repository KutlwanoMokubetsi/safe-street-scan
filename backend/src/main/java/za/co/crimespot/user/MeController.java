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
    private final com.fasterxml.jackson.databind.ObjectMapper json;
    private final za.co.crimespot.i18n.Localizer localizer;

    public MeController(UserRepository users, com.fasterxml.jackson.databind.ObjectMapper json, za.co.crimespot.i18n.Localizer localizer) {
        this.users = users;
        this.json = json;
        this.localizer = localizer;
    }

    public record EmergencyCard(boolean consent, @jakarta.validation.Valid EmergencyInfo info) {}

    @GetMapping("/emergency")
    public EmergencyCard emergency(@AuthenticationPrincipal AuthUser me) throws Exception {
        User u = load(me);
        EmergencyInfo info = u.getEmergencyInfoJson() == null ? null : json.readValue(u.getEmergencyInfoJson(), EmergencyInfo.class);
        return new EmergencyCard(u.isEmergencyConsent(), info);
    }

    /** Saved only with explicit consent: it's health information (POPIA special personal information). */
    @PutMapping("/emergency")
    public EmergencyCard saveEmergency(@AuthenticationPrincipal AuthUser me, @RequestBody @Valid EmergencyCard body) throws Exception {
        if (!body.consent()) throw new za.co.crimespot.common.BadRequestException("Tick the box to agree to share this with your friends during an SOS.");
        if (body.info() == null) throw new za.co.crimespot.common.BadRequestException("Fill in at least one detail.");
        User u = load(me);
        u.setEmergencyInfoJson(json.writeValueAsString(body.info()));
        u.setEmergencyConsent(true);
        users.save(u);
        return body;
    }

    @DeleteMapping("/emergency")
    @org.springframework.web.bind.annotation.ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void deleteEmergency(@AuthenticationPrincipal AuthUser me) {
        User u = load(me);
        u.setEmergencyInfoJson(null);
        u.setEmergencyConsent(false);
        users.save(u);
    }

    public record ProfileUpdate(
            @Size(max = 120) String fullName,
            @Size(max = 30) @Pattern(regexp = "^$|^[+0-9 ()-]{7,30}$", message = "must be a phone number") String phone,
            @jakarta.validation.constraints.DecimalMin("-90") @jakarta.validation.constraints.DecimalMax("90") Double homeLatitude,
            @jakarta.validation.constraints.DecimalMin("-180") @jakarta.validation.constraints.DecimalMax("180") Double homeLongitude,
            Integer alertRadiusM,
            Boolean clearHome,
            @Pattern(regexp = "^(en|af|zu|xh)$") String lang) {}

    private static final java.util.Set<Integer> RADII = java.util.Set.of(0, 1000, 2000, 5000);

    @GetMapping
    public UserDto me(@AuthenticationPrincipal AuthUser me) {
        return UserDto.from(load(me));
    }

    @PatchMapping
    public UserDto update(@AuthenticationPrincipal AuthUser me, @RequestBody @Valid ProfileUpdate body) {
        User u = load(me);
        if (body.fullName() != null) u.setFullName(body.fullName().isBlank() ? null : body.fullName().trim());
        if (body.phone() != null) u.setPhone(body.phone().isBlank() ? null : body.phone().trim());
        if (body.lang() != null) { u.setLang(body.lang()); localizer.forget(u.getId()); }
        if (Boolean.TRUE.equals(body.clearHome())) { u.setHomeLat(null); u.setHomeLng(null); u.setAlertRadiusM(0); }
        if (body.homeLatitude() != null && body.homeLongitude() != null) {
            // Rounded to ~100 m: precise enough for area alerts without storing an exact address.
            u.setHomeLat(Math.round(body.homeLatitude() * 1000) / 1000.0);
            u.setHomeLng(Math.round(body.homeLongitude() * 1000) / 1000.0);
        }
        if (body.alertRadiusM() != null) {
            if (!RADII.contains(body.alertRadiusM())) throw new za.co.crimespot.common.BadRequestException("Choose off, 1 km, 2 km or 5 km");
            if (body.alertRadiusM() > 0 && u.getHomeLat() == null) throw new za.co.crimespot.common.BadRequestException("Set your home area first");
            u.setAlertRadiusM(body.alertRadiusM());
        }
        return UserDto.from(users.save(u));
    }

    private User load(AuthUser me) {
        return users.findById(me.id()).orElseThrow(() -> new NotFoundException("User not found"));
    }
}
