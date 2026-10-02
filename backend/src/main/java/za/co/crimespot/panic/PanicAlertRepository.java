package za.co.crimespot.panic;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PanicAlertRepository extends JpaRepository<PanicAlert, UUID> {
    Optional<PanicAlert> findFirstByUserIdAndStatusOrderByCreatedAtDesc(UUID userId, PanicStatus status);
    List<PanicAlert> findByUserIdInAndStatusOrderByCreatedAtDesc(Collection<UUID> userIds, PanicStatus status);
}
