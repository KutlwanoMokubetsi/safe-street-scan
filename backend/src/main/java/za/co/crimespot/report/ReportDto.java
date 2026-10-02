package za.co.crimespot.report;

import java.time.Instant;
import java.util.UUID;

/**
 * Public view of a report. The reporter's identity is never exposed (POPIA);
 * {@code mine} only tells the caller whether they wrote it.
 */
public record ReportDto(
        UUID id,
        CrimeType crimeType,
        String description,
        String locationName,
        double latitude,
        double longitude,
        Instant occurredAt,
        ReportStatus status,
        Instant createdAt,
        boolean mine) {

    public static ReportDto from(CrimeReport r, UUID viewerId) {
        return new ReportDto(r.getId(), r.getCrimeType(), r.getDescription(), r.getLocationName(),
                r.getLatitude(), r.getLongitude(), r.getOccurredAt(), r.getStatus(),
                r.getCreatedAt(), r.getUserId().equals(viewerId));
    }
}
