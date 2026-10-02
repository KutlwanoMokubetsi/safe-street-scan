package za.co.crimespot.user;

import jakarta.persistence.*;
import za.co.crimespot.security.EncryptedStringConverter;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** The Keycloak subject ("sub" claim). */
    @Column(name = "keycloak_id", unique = true)
    private String keycloakId;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "full_name", columnDefinition = "text")
    @Convert(converter = EncryptedStringConverter.class)
    private String fullName;

    @Column(columnDefinition = "text")
    @Convert(converter = EncryptedStringConverter.class)
    private String phone;

    @Column(name = "home_lat", columnDefinition = "text")
    @Convert(converter = za.co.crimespot.security.EncryptedDoubleConverter.class)
    private Double homeLat;

    @Column(name = "home_lng", columnDefinition = "text")
    @Convert(converter = za.co.crimespot.security.EncryptedDoubleConverter.class)
    private Double homeLng;

    @Column(name = "alert_radius_m", nullable = false)
    private int alertRadiusM = 0;

    /** Only the token is mapped; image bytes are read on demand by AvatarService. */
    @Column(name = "avatar_token", insertable = false, updatable = false)
    private String avatarToken;

    @Column(name = "emergency_info", columnDefinition = "text")
    @Convert(converter = za.co.crimespot.security.EncryptedStringConverter.class)
    private String emergencyInfoJson;

    @Column(name = "emergency_consent", nullable = false)
    private boolean emergencyConsent;

    @Column(name = "friend_code", nullable = false, unique = true)
    private String friendCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role = Role.USER;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() { createdAt = updatedAt = Instant.now(); }

    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }

    public UUID getId() { return id; }
    public String getKeycloakId() { return keycloakId; }
    public void setKeycloakId(String keycloakId) { this.keycloakId = keycloakId; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getFriendCode() { return friendCode; }
    public void setFriendCode(String friendCode) { this.friendCode = friendCode; }
    public Double getHomeLat() { return homeLat; }
    public void setHomeLat(Double v) { this.homeLat = v; }
    public Double getHomeLng() { return homeLng; }
    public void setHomeLng(Double v) { this.homeLng = v; }
    public int getAlertRadiusM() { return alertRadiusM; }
    public void setAlertRadiusM(int v) { this.alertRadiusM = v; }
    public String getAvatarUrl() { return avatarToken == null ? null : "/api/avatars/" + avatarToken; }
    public String getEmergencyInfoJson() { return emergencyInfoJson; }
    public void setEmergencyInfoJson(String v) { this.emergencyInfoJson = v; }
    public boolean isEmergencyConsent() { return emergencyConsent; }
    public void setEmergencyConsent(boolean v) { this.emergencyConsent = v; }
    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }
    public Instant getCreatedAt() { return createdAt; }

    /** Name to show other people. */
    public String displayName() {
        return fullName != null && !fullName.isBlank() ? fullName : email.substring(0, email.indexOf('@'));
    }
}
