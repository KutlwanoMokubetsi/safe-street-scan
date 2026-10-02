package za.co.crimespot.location;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "location_shares")
public class LocationShare {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ShareReason reason;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    /** Null means until the person stops it (or the panic alert is resolved). */
    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "location_share_viewers", joinColumns = @JoinColumn(name = "share_id"))
    @Column(name = "viewer_id")
    private Set<UUID> viewers = new HashSet<>();

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public void setUserId(UUID v) { this.userId = v; }
    public ShareReason getReason() { return reason; }
    public void setReason(ShareReason v) { this.reason = v; }
    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant v) { this.startedAt = v; }
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant v) { this.expiresAt = v; }
    public Instant getEndedAt() { return endedAt; }
    public void setEndedAt(Instant v) { this.endedAt = v; }
    public Set<UUID> getViewers() { return viewers; }
    public void setViewers(Set<UUID> v) { this.viewers = v; }
}
