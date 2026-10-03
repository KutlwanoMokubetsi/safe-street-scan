package za.co.crimespot.escort;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface EscortSessionRepository extends JpaRepository<EscortSession, UUID> {
    List<EscortSession> findByWalkerIdAndStatusIn(UUID walkerId, Collection<EscortSession.Status> statuses);
    List<EscortSession> findByEscortIdAndStatusIn(UUID escortId, Collection<EscortSession.Status> statuses);
    List<EscortSession> findByStatus(EscortSession.Status status);
    List<EscortSession> findByStatusAndCreatedAtBefore(EscortSession.Status status, Instant before);
}
