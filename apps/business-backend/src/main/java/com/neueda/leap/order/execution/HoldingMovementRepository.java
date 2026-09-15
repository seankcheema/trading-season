package com.neueda.leap.order.execution;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for accessing HoldingMovement entities.
 */
public interface HoldingMovementRepository extends JpaRepository<HoldingMovement, Integer> {
}
