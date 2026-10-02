package za.co.crimespot.panic;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "panic_alerts")
public class PanicAlert {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    private Double latitude;
    private Double longitude;

    @Column(name = "accuracy_m")
    private Double accuracyM;

    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PanicStatus status = PanicStatus.ACTIVE;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @PrePersist
    void onCreate() { createdAt = Instant.now(); }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public void setUserId(UUID v) { this.userId = v; }
    public Double getLatitude() { return latitude; }
    public void setLatitude(Double v) { this.latitude = v; }
    public Double getLongitude() { return longitude; }
    public void setLongitude(Double v) { this.longitude = v; }
    public Double getAccuracyM() { return accuracyM; }
    public void setAccuracyM(Double v) { this.accuracyM = v; }
    public String getMessage() { return message; }
    public void setMessage(String v) { this.message = v; }
    public PanicStatus getStatus() { return status; }
    public void setStatus(PanicStatus v) { this.status = v; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(Instant v) { this.resolvedAt = v; }
}
