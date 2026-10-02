package za.co.crimespot.comments;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface CommentRepository extends JpaRepository<Comment, UUID> {
    List<Comment> findByReportIdOrderByCreatedAtAsc(UUID reportId, Pageable page);
    List<Comment> findByStatusOrderByCreatedAtDesc(Comment.Status status, Pageable page);
    long countByUserIdAndCreatedAtAfter(UUID userId, Instant since);

    @Query(value = "SELECT count(*) FROM comment_flags WHERE comment_id = :c AND user_id = :u", nativeQuery = true)
    int flaggedBy(@Param("c") UUID commentId, @Param("u") UUID userId);

    @Modifying
    @Query(value = "INSERT INTO comment_flags (comment_id, user_id) VALUES (:c, :u) ON CONFLICT DO NOTHING", nativeQuery = true)
    int addFlag(@Param("c") UUID commentId, @Param("u") UUID userId);

    @Query(value = "SELECT comment_id FROM comment_flags WHERE user_id = :u AND comment_id IN (:ids)", nativeQuery = true)
    List<UUID> flaggedAmong(@Param("u") UUID userId, @Param("ids") List<UUID> ids);
}
