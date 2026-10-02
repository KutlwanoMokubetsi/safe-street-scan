package za.co.crimespot.comments;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "report_comments")
public class Comment {
    public enum Status { VISIBLE, HIDDEN }

    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name = "report_id", nullable = false) private UUID reportId;
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(nullable = false, columnDefinition = "text") private String body;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private Status status = Status.VISIBLE;
    @Column(nullable = false) private int flags;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;

    @PrePersist void onCreate() { createdAt = Instant.now(); }

    public UUID getId() { return id; }
    public UUID getReportId() { return reportId; }
    public void setReportId(UUID v) { reportId = v; }
    public UUID getUserId() { return userId; }
    public void setUserId(UUID v) { userId = v; }
    public String getBody() { return body; }
    public void setBody(String v) { body = v; }
    public Status getStatus() { return status; }
    public void setStatus(Status v) { status = v; }
    public int getFlags() { return flags; }
    public void setFlags(int v) { flags = v; }
    public Instant getCreatedAt() { return createdAt; }
}
