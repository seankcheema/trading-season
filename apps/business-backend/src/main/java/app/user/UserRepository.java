package app.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

/**
 * Repository interface for accessing User entities.
 */
public interface UserRepository extends JpaRepository<User, UUID> {

    /**
     * Finds a user by username.
     *
     * @param username username to find
     * @return the matching user, if present
     */
    Optional<User> findByUsername(String username);

    /**
     * Checks whether a username is already taken.
     *
     * @param username username to test
     * @return whether a matching user exists
     */
    boolean existsByUsername(String username);

    /**
     * Checks whether an email is already registered.
     *
     * @param email email address to test
     * @return whether a matching user exists
     */
    boolean existsByEmail(String email);
}
