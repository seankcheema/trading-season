package app.cash;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

@Tag("unit")
class CashTransactionDtoTest {

    @Test
    void responseReportsADepositAmountUnchanged() {
        CashTransaction transaction = transaction(new BigDecimal("250.50"), "DEPOSIT");

        CashTransactionResponse response = CashTransactionResponse.from(transaction);

        assertEquals(1, response.cashTransactionId());
        assertEquals(new BigDecimal("250.50"), response.amount());
        assertEquals("DEPOSIT", response.reason());
        assertEquals(OffsetDateTime.parse("2026-03-01T10:00:00Z"), response.createdAt());
    }

    @Test
    void responseReportsAWithdrawalAsAPositiveAmount() {
        CashTransaction transaction = transaction(new BigDecimal("-40.00"), "WITHDRAWAL");

        CashTransactionResponse response = CashTransactionResponse.from(transaction);

        // The reason carries the direction, so a client never has to interpret a sign.
        assertEquals(new BigDecimal("40.00"), response.amount());
        assertEquals("WITHDRAWAL", response.reason());
    }

    @Test
    void requestCarriesTheAmountAndReason() {
        CashTransactionRequest request = new CashTransactionRequest(new BigDecimal("10.00"), "DEPOSIT");

        assertEquals(new BigDecimal("10.00"), request.amount());
        assertEquals("DEPOSIT", request.reason());
    }

    @Test
    void entityRoundTripsEveryField() {
        CashTransaction transaction = new CashTransaction();
        transaction.setCashTransactionId(5);
        transaction.setAccountId(12);
        transaction.setFillId(88);
        transaction.setAmount(new BigDecimal("-3.25"));
        transaction.setReason("ORDER_FILL");
        OffsetDateTime created = OffsetDateTime.parse("2026-04-01T09:30:00Z");
        transaction.setCreatedAt(created);

        assertEquals(5, transaction.getCashTransactionId());
        assertEquals(12, transaction.getAccountId());
        assertEquals(88, transaction.getFillId());
        assertEquals(new BigDecimal("-3.25"), transaction.getAmount());
        assertEquals("ORDER_FILL", transaction.getReason());
        assertEquals(created, transaction.getCreatedAt());
    }

    @Test
    void aFundingRowCarriesNoFill() {
        CashTransaction transaction = transaction(BigDecimal.TEN, CashTransaction.REASON_DEPOSIT);

        // The schema requires fill_id to be null for anything but an order fill.
        assertNull(transaction.getFillId());
        assertEquals("DEPOSIT", CashTransaction.REASON_DEPOSIT);
        assertEquals("WITHDRAWAL", CashTransaction.REASON_WITHDRAWAL);
    }

    @Test
    void insufficientFundsCarriesItsMessage() {
        InsufficientFundsException exception = new InsufficientFundsException("Insufficient funds");

        assertEquals("Insufficient funds", exception.getMessage());
    }

    private static CashTransaction transaction(BigDecimal amount, String reason) {
        CashTransaction transaction = new CashTransaction();
        transaction.setCashTransactionId(1);
        transaction.setAccountId(1);
        transaction.setAmount(amount);
        transaction.setReason(reason);
        transaction.setCreatedAt(OffsetDateTime.parse("2026-03-01T10:00:00Z"));
        return transaction;
    }
}
