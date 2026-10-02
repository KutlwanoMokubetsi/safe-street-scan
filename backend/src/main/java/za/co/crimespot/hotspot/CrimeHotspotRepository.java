package za.co.crimespot.hotspot;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface CrimeHotspotRepository extends JpaRepository<CrimeHotspot, UUID> {
    List<CrimeHotspot> findByValidUntilAfterOrderByIntensityScoreDesc(Instant now);
    long countByValidUntilAfter(Instant now);

    @Modifying
    @Query("delete from CrimeHotspot h")
    void deleteAllHotspots();
}
