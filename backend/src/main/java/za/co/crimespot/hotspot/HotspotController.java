package za.co.crimespot.hotspot;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import za.co.crimespot.report.CrimeType;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/hotspots")
public class HotspotController {

    private final HotspotService service;

    public HotspotController(HotspotService service) { this.service = service; }

    public record HotspotDto(UUID id, String name, double centerLatitude, double centerLongitude,
                             int radiusMeters, double intensityScore, int crimeCount,
                             CrimeType topCrimeType, String peakHours, String trend, String peakDays, double riskNow,
                             Instant generatedAt) {
        static HotspotDto from(CrimeHotspot h, java.time.ZonedDateTime when) {
            return new HotspotDto(h.getId(), h.getName(), h.getCenterLatitude(), h.getCenterLongitude(),
                    h.getRadiusMeters(), h.getIntensityScore(), h.getCrimeCount(),
                    h.getTopCrimeType(), h.getPeakHours(), h.getTrend(), h.getPeakDays(),
                    za.co.crimespot.hotspot.HotspotDetector.riskAt(h.getIntensityScore(), h.getPeakHours(), h.getPeakDays(), when),
                    h.getGeneratedAt());
        }
    }

    @GetMapping
    /** riskNow is computed for {@code at} (default: now), so the app can show risk for a planned time. */
    public List<HotspotDto> active(@RequestParam(required = false) Instant at) {
        java.time.ZonedDateTime when = (at == null ? Instant.now() : at).atZone(java.time.ZoneOffset.UTC);
        return service.active().stream().map(h -> HotspotDto.from(h, when)).toList();
    }

    @PostMapping("/regenerate")
    @PreAuthorize("hasAnyRole('MODERATOR','ADMIN')")
    public Map<String, Integer> regenerate() {
        return Map.of("hotspots", service.regenerate());
    }
}
