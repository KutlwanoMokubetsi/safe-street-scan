package za.co.crimespot.location;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.UUID;

public interface UserLocationRepository extends JpaRepository<UserLocation, UUID> {

    /** Positions are only kept while someone is sharing. */
    @Modifying
    @Query(value = """
           delete from user_locations ul
           where not exists (
             select 1 from location_shares s
             where s.user_id = ul.user_id and s.ended_at is null and (s.expires_at is null or s.expires_at > now()))
           """, nativeQuery = true)
    int deleteWhereNotSharing();
}
