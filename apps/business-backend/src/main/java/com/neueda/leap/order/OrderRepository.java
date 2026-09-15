package com.neueda.leap.order;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

/**
 * Repository for accessing Order entities.
 */
public interface OrderRepository extends JpaRepository<Order, Integer> {

    /**
     * Finds a prior order by its idempotency key. Checked before creating a
     * new order so a retried submission returns the original outcome
     * instead of being validated and possibly executed a second time.
     */
    Optional<Order> findByAccountIdAndClientReference(Integer accountId, UUID clientReference);
}
