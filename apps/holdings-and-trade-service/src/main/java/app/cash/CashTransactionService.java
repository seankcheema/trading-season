package app.cash;

import app.account.Account;
import app.account.AccountNotFoundException;
import app.account.AccountRepository;
import app.user.User;
import app.user.UserNotFoundException;
import app.record.CashTransferRecord;
import app.user.UserRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Moves the authenticated user's cash and reads their funding history.
 *
 * <p>Cash belongs to the user, not to an account: the balance is
 * {@code users.available_funds} and every account of theirs shares it, which is
 * why neither method takes an account id. Each movement writes the balance and
 * appends a {@link CashTransaction} in one transaction, so the cache and its
 * ledger cannot drift apart (BR-09/15).
 *
 * <p>Every operation is scoped to the user id from the verified token, so a
 * caller can only read and move their own cash.
 *
 * <p>Each movement is raised as a {@link CashTransferRecord}, which
 * {@link app.record.PlatformRecordPublisher} sends to Kafka once the
 * transaction has committed, so the reporting service sees deposits,
 * withdrawals and the balance they left without reading the ledger.
 */
@Service
public class CashTransactionService {

    /** Largest history page a caller can ask for. */
    static final int MAX_LIMIT = 200;

    /** History page size used when the caller does not ask for one. */
    static final int DEFAULT_LIMIT = 50;

    private final CashTransactionRepository cashTransactionRepository;
    private final AccountRepository accountRepository;
    private final UserRepository userRepository;
    private final ApplicationEventPublisher events;

    /**
     * Creates the service.
     *
     * @param cashTransactionRepository persistence for the cash ledger
     * @param accountRepository         used to resolve the account a row is booked against
     * @param userRepository            persistence for the balance the ledger backs
     * @param events                    publisher of the {@link CashTransferRecord} raised for a movement
     */
    public CashTransactionService(CashTransactionRepository cashTransactionRepository,
                                  AccountRepository accountRepository,
                                  UserRepository userRepository,
                                  ApplicationEventPublisher events) {
        this.cashTransactionRepository = cashTransactionRepository;
        this.accountRepository = accountRepository;
        this.userRepository = userRepository;
        this.events = events;
    }

    /**
     * Lists the user's deposits and withdrawals, newest first.
     *
     * @param userId the authenticated user's UUID from the token's sub claim
     * @param limit  how many rows to return; null or out of range falls back to
     *               {@link #DEFAULT_LIMIT}, capped at {@link #MAX_LIMIT}
     * @return the user's funding history, newest first
     */
    @Transactional(readOnly = true)
    public List<CashTransaction> getFundingHistory(UUID userId, Integer limit) {
        return cashTransactionRepository.findFundingForUser(userId, PageRequest.of(0, pageSize(limit)));
    }

    /**
     * Moves money into or out of the user's cash and records it in the ledger.
     *
     * <p>The balance row is locked before it is read, so two concurrent
     * withdrawals cannot both pass the funds check against the same balance.
     * The earliest ACTIVE account receives the ledger row; the user lock also
     * serializes transfers with lifecycle changes, so archived accounts stay read-only.
     *
     * @param userId the authenticated user's UUID from the token's sub claim
     * @param amount how much to move, positive
     * @param reason {@link CashTransaction#REASON_DEPOSIT} or
     *               {@link CashTransaction#REASON_WITHDRAWAL}
     * @return the recorded ledger row
     * @throws UserNotFoundException      if the caller has not registered a profile
     * @throws AccountNotFoundException   if the caller has no account to book the row against
     * @throws InsufficientFundsException if a withdrawal exceeds cash less open BUY reservations
     * @throws IllegalArgumentException   if the amount is not positive or the reason is unknown
     */
    @Transactional
    public CashTransaction move(UUID userId, BigDecimal amount, String reason) {
        if (amount == null || amount.signum() <= 0) {
            throw new IllegalArgumentException("Amount must be greater than 0");
        }
        boolean deposit = CashTransaction.REASON_DEPOSIT.equals(reason);
        if (!deposit && !CashTransaction.REASON_WITHDRAWAL.equals(reason)) {
            throw new IllegalArgumentException("Reason must be DEPOSIT or WITHDRAWAL");
        }

        // Locked before the balance is read, because the funds check below decides
        // whether the write is allowed.
        User user = userRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new UserNotFoundException("Account is not registered"));

        // The schema keys every ledger row to an account. Cash is the user's, so any
        // of their accounts would do; the first is the default opened at sign-up.
        Account account = accountRepository.findByUserIdOrderByOpenedDateDesc(userId).stream()
                .filter(candidate -> "ACTIVE".equals(candidate.getStatus()))
                .min(java.util.Comparator.comparing(Account::getOpenedDate).thenComparing(Account::getId))
                .orElseThrow(() -> new AccountNotFoundException("No active account is open for this user"));
        account = accountRepository.findByIdForUpdate(account.getAccountId()).orElseThrow();

        BigDecimal available = user.getAvailableFunds();
        if (!deposit && amount.compareTo(available.subtract(java.util.Objects.requireNonNullElse(accountRepository.reservedCash(userId), BigDecimal.ZERO))) > 0) {
            throw new InsufficientFundsException("Insufficient funds");
        }

        BigDecimal signed = deposit ? amount : amount.negate();
        user.setAvailableFunds(available.add(signed));
        userRepository.save(user);

        CashTransaction transaction = new CashTransaction();
        transaction.setAccountId(account.getAccountId());
        transaction.setAmount(signed);
        transaction.setReason(reason);
        transaction.setCreatedAt(OffsetDateTime.now());
        CashTransaction saved = cashTransactionRepository.save(transaction);
        events.publishEvent(CashTransferRecord.from(saved, userId, user.getAvailableFunds()));
        return saved;
    }

    private static int pageSize(Integer limit) {
        if (limit == null || limit <= 0) {
            return DEFAULT_LIMIT;
        }
        return Math.min(limit, MAX_LIMIT);
    }
}
