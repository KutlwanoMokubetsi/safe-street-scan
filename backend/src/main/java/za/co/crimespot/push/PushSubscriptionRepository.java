package za.co.crimespot.push;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, UUID> {
    List<PushSubscription> findByUserIdIn(Collection<UUID> userIds);
    Optional<PushSubscription> findByEndpoint(String endpoint);

    @Transactional
    void deleteByEndpoint(String endpoint);

    /** Insert or take over a device in one statement, so two simultaneous registrations can't collide. */
    @Transactional
    @Modifying
    @Query(value = """
           INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
           VALUES (:userId, :endpoint, :p256dh, :auth)
           ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth
           """, nativeQuery = true)
    void upsert(@Param("userId") UUID userId, @Param("endpoint") String endpoint,
                @Param("p256dh") String p256dh, @Param("auth") String auth);

    @Transactional
    void deleteByEndpointAndUserId(String endpoint, UUID userId);
}
