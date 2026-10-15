package app.account;

import app.auth.ForbiddenException;
import app.holding.CostBasis;
import app.holding.Holding;
import app.holding.HoldingMovementRepository;
import app.holding.HoldingRepository;
import app.holding.HoldingWithCost;
import app.instrument.Instrument;
import app.instrument.InstrumentRepository;
import app.record.TradingAccountRecord;
import org.springframework.context.ApplicationEventPublisher;
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
 *
 * <p>An account that is opened or renamed is raised as a
 * {@link TradingAccountRecord}, which {@link app.record.PlatformRecordPublisher}
 * sends to Kafka once the transaction has committed, so the reporting service
 * knows every account and its owner without reading this table.
 */
@Service
public class AccountService {

    private final AccountRepository accountRepository;
    private final HoldingRepository holdingRepository;
    private final HoldingMovementRepository holdingMovementRepository;
    private final InstrumentRepository instrumentRepository;
    private final ApplicationEventPublisher events;

    /**
     * Creates the service.
     *
     * @param accountRepository         persistence for accounts
     * @param holdingRepository         persistence for holdings
     * @param holdingMovementRepository the movement ledger positions are priced from
     * @param instrumentRepository      read access to the instruments held
     * @param events                    publisher of the {@link TradingAccountRecord} raised for an account
     */
    public AccountService(AccountRepository accountRepository,
                          HoldingRepository holdingRepository,
                          HoldingMovementRepository holdingMovementRepository,
                          InstrumentRepository instrumentRepository,
                          ApplicationEventPublisher events) {
        this.accountRepository = accountRepository;
        this.holdingRepository = holdingRepository;
        this.holdingMovementRepository = holdingMovementRepository;
        this.instrumentRepository = instrumentRepository;
        this.events = events;
    }

    /**
     * Retrieves active accounts belonging to the authenticated user.
     *
     * @param userId the authenticated user's UUID from the token's sub claim
     * @return a list of the user's active accounts ordered by opened date (newest first)
     */
    @Transactional(readOnly = true)
    public List<Account> getAccountsForUser(UUID userId) {
        return accountRepository.findByUserIdOrderByOpenedDateDesc(userId).stream()
                .filter(account -> "ACTIVE".equals(account.getStatus())).toList();
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

        Account saved = accountRepository.save(account);
        events.publishEvent(TradingAccountRecord.from(saved));
        return saved;
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
     * Updates the name of an ACTIVE account under the lifecycle row lock.
     *
     * @param accountId the account ID
     * @param userId    the authenticated user's UUID
     * @param newName   the new account name
     * @return the updated account
     * @throws AccountStateException if the account is archived
     * @throws AccountNotFoundException if the account does not exist
     * @throws ForbiddenException       if the account is owned by a different user
     */
    @Transactional
    public Account updateAccountName(Integer accountId, UUID userId, String newName) {
        Account account = accountRepository.findByIdForUpdate(accountId)
                .orElseThrow(() -> new AccountNotFoundException(accountId));
        if (!account.getUserId().equals(userId)) throw new ForbiddenException("You do not have access to this account");
        if (!"ACTIVE".equals(account.getStatus())) throw new AccountStateException("Archived accounts are read-only");
        account.setName(newName);
        Account saved = accountRepository.save(account);
        events.publishEvent(TradingAccountRecord.from(saved));
        return saved;
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
