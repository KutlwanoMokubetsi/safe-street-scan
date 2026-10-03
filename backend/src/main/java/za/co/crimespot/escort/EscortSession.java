package za.co.crimespot.escort;

import jakarta.persistence.*;
import za.co.crimespot.security.EncryptedDoubleConverter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "escort_sessions")
public class EscortSession {
    public enum Status { REQUESTED, ACTIVE, ENDED, DECLINED }

    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name = "walker_id", nullable = false) private UUID walkerId;
    @Column(name = "escort_id", nullable = false) private UUID escortId;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private Status status = Status.REQUESTED;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "started_at") private Instant startedAt;
    @Column(name = "ended_at") private Instant endedAt;
    /** Where the walker last "settled"; moving 40 m from here counts as moving. Encrypted like other locations. */
    @Column(name = "anchor_lat", columnDefinition = "text") @Convert(converter = EncryptedDoubleConverter.class) private Double anchorLat;
    @Column(name = "anchor_lng", columnDefinition = "text") @Convert(converter = EncryptedDoubleConverter.class) private Double anchorLng;
    @Column(name = "last_moved_at") private Instant lastMovedAt;
    @Column(name = "stationary_alerted", nullable = false) private boolean stationaryAlerted;
    @Column(name = "lost_alerted", nullable = false) private boolean lostAlerted;

    @PrePersist void onCreate() { createdAt = Instant.now(); }

    public UUID getId() { return id; }
    public UUID getWalkerId() { return walkerId; } public void setWalkerId(UUID v) { walkerId = v; }
    public UUID getEscortId() { return escortId; } public void setEscortId(UUID v) { escortId = v; }
    public Status getStatus() { return status; } public void setStatus(Status v) { status = v; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getStartedAt() { return startedAt; } public void setStartedAt(Instant v) { startedAt = v; }
    public Instant getEndedAt() { return endedAt; } public void setEndedAt(Instant v) { endedAt = v; }
    public Double getAnchorLat() { return anchorLat; } public void setAnchorLat(Double v) { anchorLat = v; }
    public Double getAnchorLng() { return anchorLng; } public void setAnchorLng(Double v) { anchorLng = v; }
    public Instant getLastMovedAt() { return lastMovedAt; } public void setLastMovedAt(Instant v) { lastMovedAt = v; }
    public boolean isStationaryAlerted() { return stationaryAlerted; } public void setStationaryAlerted(boolean v) { stationaryAlerted = v; }
    public boolean isLostAlerted() { return lostAlerted; } public void setLostAlerted(boolean v) { lostAlerted = v; }
}
