package com.neueda.leap.order.execution;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for accessing CashTransaction entities.
 */
public interface CashTransactionRepository extends JpaRepository<CashTransaction, Integer> {
}
