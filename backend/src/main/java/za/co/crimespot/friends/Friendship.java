package za.co.crimespot.friends;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "friendships")
public class Friendship {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "requester_id", nullable = false)
    private UUID requesterId;

    @Column(name = "addressee_id", nullable = false)
    private UUID addresseeId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FriendshipStatus status = FriendshipStatus.PENDING;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "responded_at")
    private Instant respondedAt;

    @PrePersist
    void onCreate() { createdAt = Instant.now(); }

    public UUID getId() { return id; }
    public UUID getRequesterId() { return requesterId; }
    public void setRequesterId(UUID v) { this.requesterId = v; }
    public UUID getAddresseeId() { return addresseeId; }
    public void setAddresseeId(UUID v) { this.addresseeId = v; }
    public FriendshipStatus getStatus() { return status; }
    public void setStatus(FriendshipStatus v) { this.status = v; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getRespondedAt() { return respondedAt; }
    public void setRespondedAt(Instant v) { this.respondedAt = v; }

    public UUID otherThan(UUID me) { return requesterId.equals(me) ? addresseeId : requesterId; }
    public boolean involves(UUID user) { return requesterId.equals(user) || addresseeId.equals(user); }
}
