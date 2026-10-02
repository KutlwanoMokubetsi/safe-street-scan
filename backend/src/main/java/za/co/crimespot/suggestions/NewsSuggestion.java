package za.co.crimespot.suggestions;

import jakarta.persistence.*;
import za.co.crimespot.report.CrimeType;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "news_suggestions")
public class NewsSuggestion {
    public enum Status { PENDING, ACCEPTED, DISMISSED }

    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name = "url_hash", nullable = false, unique = true) private String urlHash;
    @Column(nullable = false, columnDefinition = "text") private String url;
    @Column(nullable = false, columnDefinition = "text") private String title;
    @Column(name = "source_domain") private String sourceDomain;
    @Column(name = "published_at") private Instant publishedAt;
    private String area;
    @Enumerated(EnumType.STRING) @Column(name = "crime_type", nullable = false) private CrimeType crimeType;
    @Column(nullable = false) private double confidence;
    @Column(name = "place_name", nullable = false) private String placeName;
    @Column(nullable = false) private double latitude;
    @Column(nullable = false) private double longitude;
    @Column(name = "precision_m", nullable = false) private int precisionM;
    @Column(nullable = false) private int corroborations = 1;
    @Column(name = "other_sources", columnDefinition = "text") private String otherSources;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private Status status = Status.PENDING;
    @Column(name = "report_id") private UUID reportId;
    @Column(name = "reviewed_by") private UUID reviewedBy;
    @Column(name = "reviewed_at") private Instant reviewedAt;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;

    @PrePersist void onCreate() { createdAt = Instant.now(); }

    public UUID getId() { return id; }
    public String getUrlHash() { return urlHash; } public void setUrlHash(String v) { urlHash = v; }
    public String getUrl() { return url; } public void setUrl(String v) { url = v; }
    public String getTitle() { return title; } public void setTitle(String v) { title = v; }
    public String getSourceDomain() { return sourceDomain; } public void setSourceDomain(String v) { sourceDomain = v; }
    public Instant getPublishedAt() { return publishedAt; } public void setPublishedAt(Instant v) { publishedAt = v; }
    public String getArea() { return area; } public void setArea(String v) { area = v; }
    public CrimeType getCrimeType() { return crimeType; } public void setCrimeType(CrimeType v) { crimeType = v; }
    public double getConfidence() { return confidence; } public void setConfidence(double v) { confidence = v; }
    public String getPlaceName() { return placeName; } public void setPlaceName(String v) { placeName = v; }
    public double getLatitude() { return latitude; } public void setLatitude(double v) { latitude = v; }
    public double getLongitude() { return longitude; } public void setLongitude(double v) { longitude = v; }
    public int getPrecisionM() { return precisionM; } public void setPrecisionM(int v) { precisionM = v; }
    public int getCorroborations() { return corroborations; } public void setCorroborations(int v) { corroborations = v; }
    public String getOtherSources() { return otherSources; } public void setOtherSources(String v) { otherSources = v; }
    public Status getStatus() { return status; } public void setStatus(Status v) { status = v; }
    public UUID getReportId() { return reportId; } public void setReportId(UUID v) { reportId = v; }
    public UUID getReviewedBy() { return reviewedBy; } public void setReviewedBy(UUID v) { reviewedBy = v; }
    public Instant getReviewedAt() { return reviewedAt; } public void setReviewedAt(Instant v) { reviewedAt = v; }
    public Instant getCreatedAt() { return createdAt; }
}
