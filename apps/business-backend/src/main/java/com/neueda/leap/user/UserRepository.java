package com.neueda.leap.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

/**
 * Repository interface for accessing User entities.
 */
public interface UserRepository extends JpaRepository<User, UUID> {

    /** Finds a user by their username. */
    Optional<User> findByUsername(String username);

    /** Checks whether a username is already taken. */
    boolean existsByUsername(String username);

    /** Checks whether an email is already registered. */
    boolean existsByEmail(String email);
}
