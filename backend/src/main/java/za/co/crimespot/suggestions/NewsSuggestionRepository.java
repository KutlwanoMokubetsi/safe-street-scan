package za.co.crimespot.suggestions;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import za.co.crimespot.report.CrimeType;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface NewsSuggestionRepository extends JpaRepository<NewsSuggestion, UUID> {
    boolean existsByUrlHash(String urlHash);
    List<NewsSuggestion> findByStatusOrderByCreatedAtDesc(NewsSuggestion.Status status, Pageable page);
    List<NewsSuggestion> findByStatusIn(List<NewsSuggestion.Status> statuses, Pageable page);

    @Query("""
           select s from NewsSuggestion s
           where s.crimeType = :type and s.status <> za.co.crimespot.suggestions.NewsSuggestion.Status.DISMISSED
             and s.latitude between :minLat and :maxLat and s.longitude between :minLng and :maxLng
             and s.publishedAt >= :since
           """)
    List<NewsSuggestion> similar(@Param("type") CrimeType type, @Param("minLat") double minLat, @Param("maxLat") double maxLat,
                                 @Param("minLng") double minLng, @Param("maxLng") double maxLng, @Param("since") Instant since);
}
