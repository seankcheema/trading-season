package com.neueda.leap.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

/**
 * Repository interface for accessing User entities.
 */
public interface UserRepository extends JpaRepository<User, UUID> {

    /**
     * Checks whether an email is already registered, ignoring case.
     *
     * @param email the email address
     * @return {@code true} if an account uses the email in any letter case
     */
    boolean existsByEmailIgnoreCase(String email);
}
