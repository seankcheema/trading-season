package app.account;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@Tag("unit")
class AccountDtoTest {

    private static final UUID USER_ID = UUID.fromString("7c9e6679-7425-40de-944b-e07fc1f90ae7");

    @Test
    void accountResponseFromEntity() {
        Account account = new Account();
        account.setId(1);
        account.setUserId(USER_ID);
        account.setName("Test Account");
        account.setCashBalance(new BigDecimal("1000.00"));
        account.setOpenedDate(LocalDate.of(2026, 1, 1));
        account.setCurrency("USD");

        AccountResponse response = AccountResponse.from(account);

        assertEquals(1, response.accountId());
        assertEquals(USER_ID, response.userId());
        assertEquals("Test Account", response.name());
        assertEquals(new BigDecimal("1000.00"), response.cashBalance());
        assertEquals(LocalDate.of(2026, 1, 1), response.openedDate());
        assertEquals("USD", response.currency());
    }

    @Test
    void accountResponsePreservesAllFields() {
        Account account = new Account();
        account.setId(99);
        account.setUserId(USER_ID);
        account.setName("Premium Account");
        account.setCashBalance(new BigDecimal("50000.50"));
        account.setOpenedDate(LocalDate.of(2020, 5, 15));
        account.setCurrency("CAD");

        AccountResponse response = AccountResponse.from(account);

        assertNotNull(response);
        assertEquals(99, response.accountId());
        assertEquals("Premium Account", response.name());
        assertEquals(new BigDecimal("50000.50"), response.cashBalance());
        assertEquals("CAD", response.currency());
    }

    @Test
    void holdingResponseFromEntity() {
        app.holding.Holding holding = new app.holding.Holding();
        holding.setHoldingId(1);
        holding.setAccountId(10);
        holding.setInstrumentId(100);
        holding.setQuantity(new BigDecimal("10.50"));
        OffsetDateTime now = OffsetDateTime.now();
        holding.setUpdatedAt(now);

        HoldingResponse response = HoldingResponse.from(holding);

        assertEquals(1, response.holdingId());
        assertEquals(10, response.accountId());
        assertEquals(100, response.instrumentId());
        assertEquals(new BigDecimal("10.50"), response.quantity());
        assertEquals(now, response.updatedAt());
    }

    @Test
    void holdingResponsePreservesAllFields() {
        app.holding.Holding holding = new app.holding.Holding();
        holding.setHoldingId(999);
        holding.setAccountId(50);
        holding.setInstrumentId(200);
        holding.setQuantity(new BigDecimal("1000.00"));
        OffsetDateTime timestamp = OffsetDateTime.now();
        holding.setUpdatedAt(timestamp);

        HoldingResponse response = HoldingResponse.from(holding);

        assertEquals(999, response.holdingId());
        assertEquals(50, response.accountId());
        assertEquals(200, response.instrumentId());
        assertEquals(new BigDecimal("1000.00"), response.quantity());
        assertEquals(timestamp, response.updatedAt());
    }

    @Test
    void createAccountRequestCreation() {
        CreateAccountRequest request = new CreateAccountRequest("My Account");

        assertEquals("My Account", request.name());
    }

    @Test
    void createAccountRequestWithEmptyName() {
        CreateAccountRequest request = new CreateAccountRequest("");

        assertEquals("", request.name());
    }

    @Test
    void createAccountRequestWithLongName() {
        String longName = "A".repeat(1000);
        CreateAccountRequest request = new CreateAccountRequest(longName);

        assertEquals(longName, request.name());
    }

    @Test
    void updateAccountNameRequestCreation() {
        UpdateAccountNameRequest request = new UpdateAccountNameRequest("New Name");

        assertEquals("New Name", request.name());
    }

    @Test
    void updateAccountNameRequestWithEmptyName() {
        UpdateAccountNameRequest request = new UpdateAccountNameRequest("");

        assertEquals("", request.name());
    }

    @Test
    void updateAccountNameRequestWithLongName() {
        String longName = "B".repeat(500);
        UpdateAccountNameRequest request = new UpdateAccountNameRequest(longName);

        assertEquals(longName, request.name());
    }

    @Test
    void accountResponseFromEntityWithZeroCashBalance() {
        Account account = new Account();
        account.setId(1);
        account.setUserId(USER_ID);
        account.setName("Empty Account");
        account.setCashBalance(BigDecimal.ZERO);
        account.setOpenedDate(LocalDate.now());
        account.setCurrency("USD");

        AccountResponse response = AccountResponse.from(account);

        assertEquals(BigDecimal.ZERO, response.cashBalance());
    }

    @Test
    void accountResponseFromEntityWithNegativeCashBalance() {
        Account account = new Account();
        account.setId(1);
        account.setUserId(USER_ID);
        account.setName("Test");
        account.setCashBalance(new BigDecimal("-100.00"));
        account.setOpenedDate(LocalDate.now());
        account.setCurrency("USD");

        AccountResponse response = AccountResponse.from(account);

        assertEquals(new BigDecimal("-100.00"), response.cashBalance());
    }

    @Test
    void holdingResponseFromEntityWithZeroQuantity() {
        app.holding.Holding holding = new app.holding.Holding();
        holding.setHoldingId(1);
        holding.setAccountId(10);
        holding.setInstrumentId(100);
        holding.setQuantity(BigDecimal.ZERO);
        holding.setUpdatedAt(OffsetDateTime.now());

        HoldingResponse response = HoldingResponse.from(holding);

        assertEquals(BigDecimal.ZERO, response.quantity());
    }

    @Test
    void holdingResponseFromEntityWithLargeQuantity() {
        app.holding.Holding holding = new app.holding.Holding();
        holding.setHoldingId(1);
        holding.setAccountId(10);
        holding.setInstrumentId(100);
        holding.setQuantity(new BigDecimal("999999999.99"));
        holding.setUpdatedAt(OffsetDateTime.now());

        HoldingResponse response = HoldingResponse.from(holding);

        assertEquals(new BigDecimal("999999999.99"), response.quantity());
    }
}
