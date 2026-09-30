package app.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository interface for accessing User entities.
 */
public interface UserRepository extends JpaRepository<User, UUID> {

    /**
     * Loads a user with a row lock held until the enclosing transaction completes.
     * Order execution uses this, not {@code findById}, before checking and moving
     * {@code availableFunds} (KAN-93) so two concurrent orders cannot both spend
     * the same balance.
     *
     * @param userId the user's UUID
     * @return the user, or empty if none exists
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM User u WHERE u.userId = :userId")
    Optional<User> findByIdForUpdate(UUID userId);
}


