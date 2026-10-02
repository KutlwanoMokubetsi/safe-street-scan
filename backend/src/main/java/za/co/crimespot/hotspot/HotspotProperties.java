package za.co.crimespot.hotspot;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.hotspots")
public record HotspotProperties(int lookbackDays, int minReports, double epsMeters, int validHours, String cron) {}
