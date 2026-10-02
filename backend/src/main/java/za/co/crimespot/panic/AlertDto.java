package za.co.crimespot.panic;

import java.time.Instant;
import java.util.UUID;

/** A panic alert as seen by its owner or one of their friends. */
public record AlertDto(
        UUID id,
        UUID userId,
        String name,
        String phone,
        PanicStatus status,
        String message,
        Instant createdAt,
        Instant resolvedAt,
        Double latitude,
        Double longitude,
        Double accuracyM,
        Instant locationUpdatedAt,
        /** Only while the alert is active, and only if the person agreed to share it. */
        za.co.crimespot.user.EmergencyInfo emergency) {}
