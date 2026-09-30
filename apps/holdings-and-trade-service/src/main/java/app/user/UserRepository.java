package app.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

/**
 * Repository interface for accessing User entities.
 */
public interface UserRepository extends JpaRepository<User, UUID> {

}


