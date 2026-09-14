package com.neueda.leap.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

/**
 * Repository for accessing session records.
 */
public interface SessionRepository extends JpaRepository<UserSession, UUID> {
}
