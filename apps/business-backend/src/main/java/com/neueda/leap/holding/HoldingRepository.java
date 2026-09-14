package com.neueda.leap.holding;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;

import java.util.Optional;

/**
 * Repository for accessing Holding entities.
 */
public interface HoldingRepository extends JpaRepository<Holding, Integer> {

    /** Finds the current holding row for one account/instrument pair, if any. */
    Optional<Holding> findByAccountIdAndInstrumentId(Integer accountId, Integer instrumentId);

    /**
     * Same lookup, holding a row lock until the enclosing transaction
     * commits — use this in {@code OrderExecutionService} immediately
     * before writing a fill, for the same reason {@code
     * AccountRepository.findByIdForUpdate} exists.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select h from Holding h where h.accountId = :accountId and h.instrumentId = :instrumentId")
    Optional<Holding> findByAccountIdAndInstrumentIdForUpdate(Integer accountId, Integer instrumentId);
}
