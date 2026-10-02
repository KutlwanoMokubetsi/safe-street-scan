package za.co.crimespot.location;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface LocationShareRepository extends JpaRepository<LocationShare, UUID> {

    @Query("""
           select s from LocationShare s
           where s.userId = :userId and s.endedAt is null and (s.expiresAt is null or s.expiresAt > :now)
           """)
    List<LocationShare> active(@Param("userId") UUID userId, @Param("now") Instant now);

    @Query("""
           select distinct s from LocationShare s join s.viewers v
           where v = :viewer and s.endedAt is null and (s.expiresAt is null or s.expiresAt > :now)
           """)
    List<LocationShare> visibleTo(@Param("viewer") UUID viewer, @Param("now") Instant now);

    @Modifying
    @Query("update LocationShare s set s.endedAt = :now where s.endedAt is null and s.expiresAt is not null and s.expiresAt <= :now")
    int endExpired(@Param("now") Instant now);

    @Modifying
    @Query(value = """
           delete from location_share_viewers
           where viewer_id = :viewer and share_id in (select id from location_shares where user_id = :owner)
           """, nativeQuery = true)
    void removeViewer(@Param("owner") UUID owner, @Param("viewer") UUID viewer);
}
