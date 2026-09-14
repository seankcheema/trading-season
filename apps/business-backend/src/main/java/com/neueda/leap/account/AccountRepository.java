package com.neueda.leap.account;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;
import java.util.Optional;

/**
 * Repository interface for accessing Account entities.
 * AccountRepository
 */

public interface AccountRepository extends JpaRepository<Account, Integer> {
    /**
     * Loads an account with a row lock held until the enclosing transaction completes.
     * commits. Use this, not the standard findById method, which does not lock the row.
     * The caller is about to check the cash balance or perform an update, so a row lock is necessary to prevent concurrent modifications.
     * @param accountId the ID of the account to load
     * @return an Optional containing the account if found, or empty if not found
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM Account a WHERE a.id = :accountId")
    Optional<Account> findByIdForUpdate(Integer accountId);
}
