package app.account;

import app.auth.ForbiddenException;
import app.holding.CostBasis;
import app.holding.Holding;
import app.holding.HoldingMovementRepository;
import app.holding.HoldingRepository;
import app.holding.HoldingWithCost;
import app.instrument.Instrument;
import app.instrument.InstrumentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Service for managing user accounts and their holdings.
 * All operations are scoped to the authenticated user.
 */
@Service
public class AccountService {

    private final AccountRepository accountRepository;
    private final HoldingRepository holdingRepository;
    private final HoldingMovementRepository holdingMovementRepository;
    private final InstrumentRepository instrumentRepository;

    /**
     * Creates the service.
     *
     * @param accountRepository         persistence for accounts
     * @param holdingRepository         persistence for holdings
     * @param holdingMovementRepository the movement ledger positions are priced from
     * @param instrumentRepository      read access to the instruments held
     */
    public AccountService(AccountRepository accountRepository,
                          HoldingRepository holdingRepository,
                          HoldingMovementRepository holdingMovementRepository,
                          InstrumentRepository instrumentRepository) {
        this.accountRepository = accountRepository;
        this.holdingRepository = holdingRepository;
        this.holdingMovementRepository = holdingMovementRepository;
        this.instrumentRepository = instrumentRepository;
    }

    /**
     * Retrieves active accounts belonging to the authenticated user; archived accounts remain stored.
     *
     * @param userId the authenticated user's UUID from the token's sub claim
     * @return a list of the user's accounts ordered by opened date (newest first)
     */
    @Transactional(readOnly = true)
    public List<Account> getAccountsForUser(UUID userId) {
        return accountRepository.findByUserIdOrderByOpenedDateDesc(userId).stream()
                .filter(account -> account.getArchivedAt() == null).toList();
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
     * Updates the name of an active account under the archive and trading row lock.
     * @throws org.springframework.web.server.ResponseStatusException if archived
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
        Account account = lockedOwnedAccount(accountId, userId);
        requireActive(account);
        account.setName(newName);
        return accountRepository.save(account);
    }

    /**
     * Archives an empty owned account without deleting any history. Repeated calls are harmless.
     * @param accountId the account ID
     * @param userId verified owner
     * @throws AccountNotFoundException if missing
     * @throws ForbiddenException if owned by another user
     * @throws org.springframework.web.server.ResponseStatusException if positions remain
     */
    @Transactional
    public void archiveAccount(Integer accountId, UUID userId) {
        Account account = lockedOwnedAccount(accountId, userId);
        if (account.getArchivedAt() != null) return;
        if (holdingRepository.findByAccountId(accountId).stream()
                .anyMatch(holding -> holding.getQuantity().signum() != 0)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.UNPROCESSABLE_CONTENT,
                    "Close all positions before deleting this account");
        }
        account.setArchivedAt(java.time.Instant.now());
        accountRepository.save(account);
    }

    private Account lockedOwnedAccount(Integer accountId, UUID userId) {
        Account account = accountRepository.findByIdForUpdate(accountId)
                .orElseThrow(() -> new AccountNotFoundException(accountId));
        if (!account.getUserId().equals(userId))
            throw new ForbiddenException("You do not have access to this account");
        return account;
    }

    /**
     * Rejects mutations of an archived account.
     * @param account the account being changed
     * @throws org.springframework.web.server.ResponseStatusException if archived
     */
    public static void requireActive(Account account) {
        if (account.getArchivedAt() != null)
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT, "This account is archived");
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
    public List<HoldingWithCost> getHoldingsForAccount(Integer accountId, UUID userId) {
        // Verify ownership first
        getAccountForUser(accountId, userId);

        List<Holding> holdings = holdingRepository.findByAccountId(accountId);
        if (holdings.isEmpty()) {
            return List.of();
        }

        // Two batched lookups rather than one query per position.
        Map<Integer, Instrument> instruments = instrumentRepository
                .findByInstrumentIdIn(holdings.stream().map(Holding::getInstrumentId).toList())
                .stream()
                .collect(Collectors.toMap(Instrument::getInstrumentId, Function.identity()));
        Map<Integer, BigDecimal> averageCosts =
                CostBasis.averageCosts(holdingMovementRepository.pricedMovements(accountId));

        return holdings.stream()
                .map(holding -> new HoldingWithCost(
                        holding,
                        instruments.get(holding.getInstrumentId()),
                        averageCosts.get(holding.getInstrumentId())))
                .toList();
    }
}
