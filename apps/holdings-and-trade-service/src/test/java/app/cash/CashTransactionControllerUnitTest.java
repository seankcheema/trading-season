package app.cash;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class CashTransactionControllerUnitTest {

    private static final UUID USER_ID = UUID.fromString("7c9e6679-7425-40de-944b-e07fc1f90ae7");

    @Mock
    private CashTransactionService cashTransactionService;

    @Mock
    private Jwt jwt;

    private CashTransactionController controller;

    @BeforeEach
    void setUp() {
        controller = new CashTransactionController(cashTransactionService);
    }

    @Test
    void listFundingPassesTheTokenSubjectAndTheLimitThrough() {
        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(cashTransactionService.getFundingHistory(USER_ID, 20))
                .thenReturn(List.of(transaction(1, new BigDecimal("-40.00"), "WITHDRAWAL")));

        List<CashTransactionResponse> result = controller.listFunding(20, jwt);

        assertEquals(1, result.size());
        // The stored amount is signed; the response reports it positive.
        assertEquals(new BigDecimal("40.00"), result.get(0).amount());
        assertEquals("WITHDRAWAL", result.get(0).reason());
        verify(cashTransactionService).getFundingHistory(USER_ID, 20);
    }

    @Test
    void listFundingWithoutALimitPassesNullThrough() {
        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(cashTransactionService.getFundingHistory(USER_ID, null)).thenReturn(List.of());

        assertTrue(controller.listFunding(null, jwt).isEmpty());

        verify(cashTransactionService).getFundingHistory(USER_ID, null);
    }

    @Test
    void postFundingMovesCashForTheTokenSubject() {
        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(cashTransactionService.move(USER_ID, new BigDecimal("50.25"), "DEPOSIT"))
                .thenReturn(transaction(9, new BigDecimal("50.25"), "DEPOSIT"));

        CashTransactionResponse response = controller.postFunding(
                new CashTransactionRequest(new BigDecimal("50.25"), "DEPOSIT"), jwt);

        assertEquals(9, response.cashTransactionId());
        assertEquals(new BigDecimal("50.25"), response.amount());
        assertEquals("DEPOSIT", response.reason());
        verify(cashTransactionService).move(USER_ID, new BigDecimal("50.25"), "DEPOSIT");
    }

    private static CashTransaction transaction(int id, BigDecimal amount, String reason) {
        CashTransaction transaction = new CashTransaction();
        transaction.setCashTransactionId(id);
        transaction.setAccountId(1);
        transaction.setAmount(amount);
        transaction.setReason(reason);
        transaction.setCreatedAt(OffsetDateTime.parse("2026-03-01T10:00:00Z"));
        return transaction;
    }
}
