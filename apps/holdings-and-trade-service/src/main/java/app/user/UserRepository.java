package app.user;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

/**
 * Repository interface for accessing User entities.
 */
public interface UserRepository extends JpaRepository<User, UUID> {

    /**
     * Loads a profile with a row lock held until the enclosing transaction
     * completes. Use this, not {@code findById}, when the caller is about to
     * check {@code availableFunds} and then write it: without the lock two
     * concurrent withdrawals can both pass the funds check against the same
     * balance and overdraw it.
     *
     * @param userId the profile to load
     * @return the profile if it exists, empty otherwise
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.userId = :userId")
    Optional<User> findByIdForUpdate(UUID userId);
}


