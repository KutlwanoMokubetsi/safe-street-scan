package za.co.crimespot.report;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface CrimeReportRepository extends JpaRepository<CrimeReport, UUID> {

    @Query("""
            select r from CrimeReport r
            where r.latitude between :minLat and :maxLat
              and r.longitude between :minLng and :maxLng
              and r.occurredAt >= :since
              and r.status in :statuses
            order by r.occurredAt desc
            """)
    List<CrimeReport> findInArea(@Param("minLat") double minLat, @Param("maxLat") double maxLat,
                                 @Param("minLng") double minLng, @Param("maxLng") double maxLng,
                                 @Param("since") Instant since,
                                 @Param("statuses") Collection<ReportStatus> statuses,
                                 Pageable page);

    List<CrimeReport> findByStatusInOrderByOccurredAtDesc(Collection<ReportStatus> statuses, Pageable page);

    List<CrimeReport> findByUserIdOrderByCreatedAtDesc(UUID userId);

    List<CrimeReport> findByStatusOrderByCreatedAtAsc(ReportStatus status, Pageable page);

    List<CrimeReport> findByOccurredAtAfterAndStatusIn(Instant since, Collection<ReportStatus> statuses);

    long countByStatus(ReportStatus status);

    @Query("""
            select count(r) from CrimeReport r
            where r.crimeType = :type and r.status <> za.co.crimespot.report.ReportStatus.REJECTED
              and r.latitude between :minLat and :maxLat and r.longitude between :minLng and :maxLng
              and r.occurredAt between :from and :to
            """)
    long countSimilar(@Param("type") CrimeType type, @Param("minLat") double minLat, @Param("maxLat") double maxLat,
                      @Param("minLng") double minLng, @Param("maxLng") double maxLng,
                      @Param("from") Instant from, @Param("to") Instant to);

    @Query("select r.description, r.crimeType from CrimeReport r where r.status = za.co.crimespot.report.ReportStatus.VERIFIED and r.source = 'USER' order by r.createdAt desc")
    List<Object[]> verifiedTrainingData(Pageable page);

    long countByStatusIn(Collection<ReportStatus> statuses);

    long countByOccurredAtAfterAndStatusIn(Instant since, Collection<ReportStatus> statuses);

    long countByUserIdAndCreatedAtAfter(UUID userId, Instant since);
}
