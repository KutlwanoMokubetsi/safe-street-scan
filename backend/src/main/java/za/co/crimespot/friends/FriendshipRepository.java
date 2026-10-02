package za.co.crimespot.friends;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FriendshipRepository extends JpaRepository<Friendship, UUID> {

    @Query("select f from Friendship f where f.requesterId = :me or f.addresseeId = :me order by f.createdAt desc")
    List<Friendship> findAllFor(@Param("me") UUID me);

    @Query("""
           select f from Friendship f
           where (f.requesterId = :a and f.addresseeId = :b) or (f.requesterId = :b and f.addresseeId = :a)
           """)
    Optional<Friendship> findBetween(@Param("a") UUID a, @Param("b") UUID b);

    @Query("""
           select case when f.requesterId = :me then f.addresseeId else f.requesterId end
           from Friendship f
           where (f.requesterId = :me or f.addresseeId = :me) and f.status = za.co.crimespot.friends.FriendshipStatus.ACCEPTED
           """)
    List<UUID> friendIdsOf(@Param("me") UUID me);
}
