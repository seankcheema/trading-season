package app.account;

import app.auth.AuthenticatedUser;
import app.auth.ForbiddenException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class AccountControllerUnitTest {

    private static final UUID USER_ID = UUID.fromString("7c9e6679-7425-40de-944b-e07fc1f90ae7");

    @Mock
    private AccountService accountService;

    @Mock
    private Jwt jwt;

    private AccountController controller;

    @BeforeEach
    void setUp() {
        controller = new AccountController(accountService);
    }

    @Test
    void listAccountsReturnsAccountResponses() {
        Account account1 = createAccount(1, USER_ID, "Main Account");
        Account account2 = createAccount(2, USER_ID, "Secondary Account");
        
        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(accountService.getAccountsForUser(USER_ID))
                .thenReturn(List.of(account1, account2));

        List<AccountResponse> result = controller.listAccounts(jwt);

        assertEquals(2, result.size());
        assertEquals("Main Account", result.get(0).name());
        assertEquals("Secondary Account", result.get(1).name());
        verify(accountService).getAccountsForUser(USER_ID);
    }

    @Test
    void listAccountsReturnsEmptyList() {
        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(accountService.getAccountsForUser(USER_ID))
                .thenReturn(List.of());

        List<AccountResponse> result = controller.listAccounts(jwt);

        assertTrue(result.isEmpty());
    }

    @Test
    void getAccountReturnsAccountResponse() {
        Account account = createAccount(1, USER_ID, "Main Account");
        
        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(accountService.getAccountForUser(1, USER_ID))
                .thenReturn(account);

        AccountResponse result = controller.getAccount(1, jwt);

        assertEquals("Main Account", result.name());
        assertEquals(USER_ID, result.userId());
        assertEquals(1, result.accountId());
    }

    @Test
    void getAccountThrowsForbiddenWhenNotOwned() {
        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(accountService.getAccountForUser(1, USER_ID))
                .thenThrow(new ForbiddenException("Access denied"));

        assertThrows(ForbiddenException.class, 
                () -> controller.getAccount(1, jwt));
    }

    @Test
    void getAccountThrowsNotFoundWhenNotFound() {
        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(accountService.getAccountForUser(99, USER_ID))
                .thenThrow(new AccountNotFoundException(99));

        assertThrows(AccountNotFoundException.class, 
                () -> controller.getAccount(99, jwt));
    }

    private static app.instrument.Instrument instrument(int instrumentId, String ticker) {
        app.instrument.Instrument instrument = new app.instrument.Instrument();
        instrument.setInstrumentId(instrumentId);
        instrument.setTicker(ticker);
        instrument.setName(ticker + " Inc.");
        return instrument;
    }

    @Test
    void listHoldingsReturnsHoldingResponses() {
        app.holding.Holding holding1 = createHolding(1, 1, 100, BigDecimal.TEN);
        app.holding.Holding holding2 = createHolding(2, 1, 101, BigDecimal.ONE);

        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(accountService.getHoldingsForAccount(1, USER_ID))
                .thenReturn(List.of(
                        new app.holding.HoldingWithCost(holding1, instrument(100, "AAPL"),
                                new BigDecimal("280.10")),
                        new app.holding.HoldingWithCost(holding2, null, null)));

        List<HoldingResponse> result = controller.listHoldings(1, jwt);

        assertEquals(2, result.size());
        assertEquals(100, result.get(0).instrumentId());
        assertEquals("AAPL", result.get(0).symbol());
        assertEquals(new BigDecimal("280.10"), result.get(0).averageCost());
        assertEquals(101, result.get(1).instrumentId());
        // An unresolved instrument falls back to its id, and an unknown cost to zero.
        assertEquals("101", result.get(1).symbol());
        assertEquals(BigDecimal.ZERO, result.get(1).averageCost());
    }

    @Test
    void listHoldingsReturnsEmptyList() {
        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(accountService.getHoldingsForAccount(1, USER_ID))
                .thenReturn(List.of());

        List<HoldingResponse> result = controller.listHoldings(1, jwt);

        assertTrue(result.isEmpty());
    }

    @Test
    void listHoldingsThrowsForbiddenWhenAccountNotOwned() {
        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(accountService.getHoldingsForAccount(1, USER_ID))
                .thenThrow(new ForbiddenException("Access denied"));

        assertThrows(ForbiddenException.class, 
                () -> controller.listHoldings(1, jwt));
    }

    @Test
    void createAccountReturnsNewAccountResponse() {
        Account newAccount = createAccount(1, USER_ID, "New Account");
        CreateAccountRequest request = new CreateAccountRequest("New Account");
        
        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(accountService.createAccount(USER_ID, "New Account"))
                .thenReturn(newAccount);

        AccountResponse result = controller.createAccount(request, jwt);

        assertEquals("New Account", result.name());
        assertEquals(USER_ID, result.userId());
    }

    @Test
    void updateAccountReturnsUpdatedAccountResponse() {
        Account updatedAccount = createAccount(1, USER_ID, "Updated Name");
        UpdateAccountNameRequest request = new UpdateAccountNameRequest("Updated Name");
        
        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(accountService.updateAccountName(1, USER_ID, "Updated Name"))
                .thenReturn(updatedAccount);

        AccountResponse result = controller.updateAccount(1, request, jwt);

        assertEquals("Updated Name", result.name());
    }

    @Test
    void updateAccountThrowsForbiddenWhenNotOwned() {
        UpdateAccountNameRequest request = new UpdateAccountNameRequest("New Name");
        
        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(accountService.updateAccountName(1, USER_ID, "New Name"))
                .thenThrow(new ForbiddenException("Access denied"));

        assertThrows(ForbiddenException.class, 
                () -> controller.updateAccount(1, request, jwt));
    }

    @Test
    void createAccountCallsServiceWithCorrectParameters() {
        Account newAccount = createAccount(1, USER_ID, "Test Account");
        CreateAccountRequest request = new CreateAccountRequest("Test Account");
        
        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(accountService.createAccount(USER_ID, "Test Account"))
                .thenReturn(newAccount);

        controller.createAccount(request, jwt);

        verify(accountService).createAccount(USER_ID, "Test Account");
    }

    @Test
    void listAccountsExtractsUserIdFromJwt() {
        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(accountService.getAccountsForUser(USER_ID))
                .thenReturn(List.of());

        controller.listAccounts(jwt);

        verify(accountService).getAccountsForUser(USER_ID);
    }

    @Test
    void getAccountCallsServiceWithAccountIdAndUserId() {
        Account account = createAccount(1, USER_ID, "Main");
        
        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(accountService.getAccountForUser(1, USER_ID))
                .thenReturn(account);

        controller.getAccount(1, jwt);

        verify(accountService).getAccountForUser(1, USER_ID);
    }

    @Test
    void listHoldingsCallsServiceWithCorrectParameters() {
        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(accountService.getHoldingsForAccount(1, USER_ID))
                .thenReturn(List.of());

        controller.listHoldings(1, jwt);

        verify(accountService).getHoldingsForAccount(1, USER_ID);
    }

    @Test
    void updateAccountCallsServiceWithAllParameters() {
        Account updatedAccount = createAccount(1, USER_ID, "New");
        UpdateAccountNameRequest request = new UpdateAccountNameRequest("New");
        
        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(accountService.updateAccountName(1, USER_ID, "New"))
                .thenReturn(updatedAccount);

        controller.updateAccount(1, request, jwt);

        verify(accountService).updateAccountName(1, USER_ID, "New");
    }

    @Test
    void createAccountResponseConversionPreservesData() {
        Account account = new Account();
        account.setId(1);
        account.setUserId(USER_ID);
        account.setName("Test");
        account.setCashBalance(new BigDecimal("100.00"));
        account.setOpenedDate(LocalDate.now());
        account.setCurrency("USD");
        
        CreateAccountRequest request = new CreateAccountRequest("Test");
        
        when(jwt.getSubject()).thenReturn(USER_ID.toString());
        when(accountService.createAccount(USER_ID, "Test"))
                .thenReturn(account);

        AccountResponse result = controller.createAccount(request, jwt);

        assertEquals(1, result.accountId());
        assertEquals("Test", result.name());
        assertEquals(new BigDecimal("100.00"), result.cashBalance());
    }

    // Helper methods
    private Account createAccount(Integer id, UUID userId, String name) {
        Account account = new Account();
        account.setId(id);
        account.setUserId(userId);
        account.setName(name);
        account.setOpenedDate(LocalDate.now());
        account.setCashBalance(BigDecimal.ZERO);
        account.setCurrency("USD");
        return account;
    }

    private app.holding.Holding createHolding(Integer holdingId, Integer accountId, Integer instrumentId, BigDecimal quantity) {
        app.holding.Holding holding = new app.holding.Holding();
        holding.setHoldingId(holdingId);
        holding.setAccountId(accountId);
        holding.setInstrumentId(instrumentId);
        holding.setQuantity(quantity);
        holding.setUpdatedAt(OffsetDateTime.now());
        return holding;
    }
}
