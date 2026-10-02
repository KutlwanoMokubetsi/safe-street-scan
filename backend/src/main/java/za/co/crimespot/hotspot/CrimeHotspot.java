package za.co.crimespot.hotspot;

import jakarta.persistence.*;
import za.co.crimespot.report.CrimeType;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "crime_hotspots")
public class CrimeHotspot {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(name = "center_latitude", nullable = false)
    private double centerLatitude;

    @Column(name = "center_longitude", nullable = false)
    private double centerLongitude;

    @Column(name = "radius_meters", nullable = false)
    private int radiusMeters;

    @Column(name = "intensity_score", nullable = false)
    private double intensityScore;

    @Column(name = "crime_count", nullable = false)
    private int crimeCount;

    @Enumerated(EnumType.STRING)
    @Column(name = "top_crime_type")
    private CrimeType topCrimeType;

    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;

    @Column(name = "valid_until", nullable = false)
    private Instant validUntil;

    public UUID getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public double getCenterLatitude() { return centerLatitude; }
    public void setCenterLatitude(double v) { this.centerLatitude = v; }
    public double getCenterLongitude() { return centerLongitude; }
    public void setCenterLongitude(double v) { this.centerLongitude = v; }
    public int getRadiusMeters() { return radiusMeters; }
    public void setRadiusMeters(int v) { this.radiusMeters = v; }
    public double getIntensityScore() { return intensityScore; }
    public void setIntensityScore(double v) { this.intensityScore = v; }
    public int getCrimeCount() { return crimeCount; }
    public void setCrimeCount(int v) { this.crimeCount = v; }
    public CrimeType getTopCrimeType() { return topCrimeType; }
    public void setTopCrimeType(CrimeType v) { this.topCrimeType = v; }
    public Instant getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(Instant v) { this.generatedAt = v; }
    public Instant getValidUntil() { return validUntil; }
    public void setValidUntil(Instant v) { this.validUntil = v; }
}
