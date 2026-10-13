package app.record;

import app.cash.CashTransaction;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A deposit or withdrawal, published as {@value #TYPE}. It carries the
 * balance the movement left, so a consumer can keep the trader's cash without
 * reading the ledger. What an order's fill posts to cash is not a transfer
 * and travels on the order's own event instead.
 *
 * @param cashTransactionId the cash ledger row
 * @param accountId         the account the row is booked against
 * @param userId            the trader whose cash moved
 * @param amount            the signed amount: positive for a deposit, negative for a withdrawal
 * @param reason            {@code DEPOSIT} or {@code WITHDRAWAL}
 * @param createdAt         when the movement was recorded
 * @param availableFunds    the trader's available funds after the movement
 */
public record CashTransferRecord(
        Integer cashTransactionId,
        Integer accountId,
        UUID userId,
        BigDecimal amount,
        String reason,
        OffsetDateTime createdAt,
        BigDecimal availableFunds) implements PlatformRecord {

    /** The record type deposits and withdrawals are published under. */
    public static final String TYPE = "CASH_TRANSFER";

    /**
     * Captures a saved ledger row and the balance it left.
     *
     * @param transaction    the row after it was saved, so that it has its id
     * @param userId         the trader whose cash moved
     * @param availableFunds the trader's available funds after the movement
     * @return the record describing it
     */
    public static CashTransferRecord from(CashTransaction transaction, UUID userId, BigDecimal availableFunds) {
        return new CashTransferRecord(transaction.getCashTransactionId(), transaction.getAccountId(), userId,
                transaction.getAmount(), transaction.getReason(), transaction.getCreatedAt(), availableFunds);
    }

    @Override
    public String recordType() {
        return TYPE;
    }

    @Override
    public String recordId() {
        return String.valueOf(cashTransactionId);
    }
}
