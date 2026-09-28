package app.account;

import app.auth.ForbiddenException;
import app.holding.Holding;
import app.holding.HoldingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Service for managing user accounts and their holdings.
 * All operations are scoped to the authenticated user.
 */
@Service
public class AccountService {

    private final AccountRepository accountRepository;
    private final HoldingRepository holdingRepository;

    /**
     * Creates the service.
     *
     * @param accountRepository  persistence for accounts
     * @param holdingRepository  persistence for holdings
     */
    public AccountService(AccountRepository accountRepository, HoldingRepository holdingRepository) {
        this.accountRepository = accountRepository;
        this.holdingRepository = holdingRepository;
    }

    /**
     * Retrieves all accounts belonging to the authenticated user.
     *
     * @param userId the authenticated user's UUID from the token's sub claim
     * @return a list of the user's accounts ordered by opened date (newest first)
     */
    @Transactional(readOnly = true)
    public List<Account> getAccountsForUser(UUID userId) {
        return accountRepository.findByUserIdOrderByOpenedDateDesc(userId);
    }

    /**
     * Retrieves a specific account if it belongs to the authenticated user.
     *
     * @param accountId the account ID
     * @param userId    the authenticated user's UUID
     * @return the account
     * @throws AccountNotFoundException if the account does not exist
     * @throws ForbiddenException       if the account is owned by a different user
     */
    @Transactional(readOnly = true)
    public Account getAccountForUser(Integer accountId, UUID userId) {
        Account account = accountRepository.findByIdAndUserId(accountId, userId)
                .orElseThrow(() -> {
                    // Check if account exists at all to provide different error message
                    if (accountRepository.existsById(accountId)) {
                        return new ForbiddenException("You do not have access to this account");
                    } else {
                        return new AccountNotFoundException(accountId);
                    }
                });
        return account;
    }

    /**
     * Verifies that an account belongs to the given user.
     *
     * @param accountId the account ID
     * @param userId    the user's UUID
     * @return true if the account exists and belongs to this user, false otherwise
     */
    @Transactional(readOnly = true)
    public boolean verifyAccountOwnership(Integer accountId, UUID userId) {
        return accountRepository.findByIdAndUserId(accountId, userId).isPresent();
    }

    /**
     * Creates a new account for the authenticated user.
     *
     * @param userId    the authenticated user's UUID
     * @param name      the account name
     * @return the newly created account
     */
    @Transactional
    public Account createAccount(UUID userId, String name) {
        Account account = new Account();
        account.setUserId(userId);
        account.setName(name);
        account.setOpenedDate(LocalDate.now());
        account.setCurrency("USD");
        
        return accountRepository.save(account);
    }

    /**
     * Creates a default "Main Account" for a new user.
     * This should be called immediately after user registration.
     *
     * @param userId the new user's UUID
     * @return the newly created default account
     */
    @Transactional
    public Account createDefaultAccountForUser(UUID userId) {
        return createAccount(userId, "Main Account");
    }

    /**
     * Updates the name of an account.
     *
     * @param accountId the account ID
     * @param userId    the authenticated user's UUID
     * @param newName   the new account name
     * @return the updated account
     * @throws AccountNotFoundException if the account does not exist
     * @throws ForbiddenException       if the account is owned by a different user
     */
    @Transactional
    public Account updateAccountName(Integer accountId, UUID userId, String newName) {
        Account account = getAccountForUser(accountId, userId);
        account.setName(newName);
        return accountRepository.save(account);
    }

    /**
     * Retrieves all holdings for a specific account.
     * Verifies the account belongs to the authenticated user.
     *
     * @param accountId the account ID
     * @param userId    the authenticated user's UUID
     * @return a list of holdings for this account
     * @throws AccountNotFoundException if the account does not exist
     * @throws ForbiddenException       if the account is owned by a different user
     */
    @Transactional(readOnly = true)
    public List<Holding> getHoldingsForAccount(Integer accountId, UUID userId) {
        // Verify ownership first
        getAccountForUser(accountId, userId);
        
        // Return all holdings for this account
        return holdingRepository.findByAccountId(accountId);
    }
}
