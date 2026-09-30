package app.cash;

import app.account.Account;
import app.account.AccountNotFoundException;
import app.account.AccountRepository;
import app.user.User;
import app.user.UserNotFoundException;
import app.user.UserRepository;
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

    /**
     * Creates the service.
     *
     * @param cashTransactionRepository persistence for the cash ledger
     * @param accountRepository         used to resolve the account a row is booked against
     * @param userRepository            persistence for the balance the ledger backs
     */
    public CashTransactionService(CashTransactionRepository cashTransactionRepository,
                                  AccountRepository accountRepository,
                                  UserRepository userRepository) {
        this.cashTransactionRepository = cashTransactionRepository;
        this.accountRepository = accountRepository;
        this.userRepository = userRepository;
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
     *
     * @param userId the authenticated user's UUID from the token's sub claim
     * @param amount how much to move, positive
     * @param reason {@link CashTransaction#REASON_DEPOSIT} or
     *               {@link CashTransaction#REASON_WITHDRAWAL}
     * @return the recorded ledger row
     * @throws UserNotFoundException      if the caller has not registered a profile
     * @throws AccountNotFoundException   if the caller has no account to book the row against
     * @throws InsufficientFundsException if a withdrawal exceeds the available funds
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
        Account account = accountRepository.findFirstByUserIdOrderByOpenedDateAscIdAsc(userId)
                .orElseThrow(() -> new AccountNotFoundException("No account is open for this user"));

        BigDecimal available = user.getAvailableFunds();
        if (!deposit && amount.compareTo(available) > 0) {
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
        return cashTransactionRepository.save(transaction);
    }

    private static int pageSize(Integer limit) {
        if (limit == null || limit <= 0) {
            return DEFAULT_LIMIT;
        }
        return Math.min(limit, MAX_LIMIT);
    }
}
