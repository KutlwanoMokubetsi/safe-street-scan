package za.co.crimespot.user;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByKeycloakId(String keycloakId);
    Optional<User> findByEmailIgnoreCase(String email);
    Optional<User> findByFriendCode(String friendCode);
    boolean existsByFriendCode(String friendCode);
}
