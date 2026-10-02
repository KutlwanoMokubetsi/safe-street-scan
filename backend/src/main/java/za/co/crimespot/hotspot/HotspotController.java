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
                             CrimeType topCrimeType, String peakHours, String trend, Instant generatedAt) {
        static HotspotDto from(CrimeHotspot h) {
            return new HotspotDto(h.getId(), h.getName(), h.getCenterLatitude(), h.getCenterLongitude(),
                    h.getRadiusMeters(), h.getIntensityScore(), h.getCrimeCount(),
                    h.getTopCrimeType(), h.getPeakHours(), h.getTrend(), h.getGeneratedAt());
        }
    }

    @GetMapping
    public List<HotspotDto> active() {
        return service.active().stream().map(HotspotDto::from).toList();
    }

    @PostMapping("/regenerate")
    @PreAuthorize("hasAnyRole('MODERATOR','ADMIN')")
    public Map<String, Integer> regenerate() {
        return Map.of("hotspots", service.regenerate());
    }
}
