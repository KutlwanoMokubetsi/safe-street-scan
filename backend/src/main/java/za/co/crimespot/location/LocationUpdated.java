package za.co.crimespot.location;

import java.util.UUID;

/** Published after a user's position is saved; lets other features react without depending on LocationService. */
public record LocationUpdated(UUID userId, double lat, double lng) {}
