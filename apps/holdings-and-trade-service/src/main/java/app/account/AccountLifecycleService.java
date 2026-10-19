package app.account;

import app.auth.ForbiddenException;
import app.record.TradingAccountRecord;
import app.user.UserRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Validates and changes portfolio lifecycle without deleting financial history.
 * User then account locks serialize transfers, concurrent closures, and order acceptance.
 * Cash is shared: account cash is checked here, while shared user funds remain available
 * through any remaining active account. A user can create another active account later.
 */
@Service
public class AccountLifecycleService {
    private final AccountRepository accounts;
    private final UserRepository users;
    private final ApplicationEventPublisher events;

    /**
     * Creates lifecycle management.
     * @param accounts account persistence and row locks
     * @param users shared cash row lock
     * @param events committed account reporting records
     */
    public AccountLifecycleService(AccountRepository accounts, UserRepository users,
            ApplicationEventPublisher events) {
        this.accounts = accounts; this.users = users; this.events = events;
    }

    /**
     * Lists retained archived accounts belonging to the caller.
     * @param userId verified owner
     * @return archived accounts newest first
     */
    @Transactional(readOnly = true)
    public List<Account> archived(UUID userId) {
        return accounts.findByUserIdOrderByOpenedDateDesc(userId).stream()
                .filter(a -> "ARCHIVED".equals(a.getStatus())).toList();
    }

    /**
     * Explains lifecycle eligibility; mutations always repeat these checks under locks.
     * @param id account id
     * @param userId verified owner
     * @return blockers for each operation
     * @throws AccountNotFoundException if missing
     * @throws ForbiddenException if unowned
     */
    @Transactional(readOnly = true)
    public Eligibility eligibility(Integer id, UUID userId) { return checks(owned(id, userId, false)); }

    /**
     * Archives an eligible account, retaining every ledger and historical relationship.
     * @param id account id
     * @param userId verified owner
     * @return read-only archived account
     * @throws AccountStateException if any requirement fails or already archived
     * @throws AccountNotFoundException if missing
     * @throws ForbiddenException if unowned
     */
    @Transactional
    public Account archive(Integer id, UUID userId) {
        Account account = owned(id, userId, true);
        return archiveLocked(account);
    }

    private Account archiveLocked(Account account) {
        require(checks(account).archiveBlockers());
        account.setStatus("ARCHIVED"); account.setArchivedAt(Instant.now());
        accounts.save(account);
        events.publishEvent(TradingAccountRecord.from(account));
        return account;
    }

    /**
     * Hides an account from the client by archiving it after explicit confirmation.
     * No account, holding, transaction, order, or valuation row is deleted.
     * @param id account id
     * @param userId verified owner
     * @param confirmed explicit user confirmation
     * @throws IllegalArgumentException if confirmation is absent
     * @throws AccountStateException if assets or open orders remain, or already archived
     * @throws AccountNotFoundException if missing
     * @throws ForbiddenException if unowned
     */
    @Transactional
    public void delete(Integer id, UUID userId, boolean confirmed) {
        // Check ownership before reporting confirmation errors.
        Account account = owned(id, userId, true);
        if (!confirmed) throw new IllegalArgumentException("Explicit deletion confirmation is required");
        archiveLocked(account);
    }

    private Account owned(Integer id, UUID userId, boolean lock) {
        if (lock) users.findByIdForUpdate(userId);
        Account account = (lock ? accounts.findByIdForUpdate(id) : accounts.findById(id))
                .orElseThrow(() -> new AccountNotFoundException(id));
        if (!account.getUserId().equals(userId)) throw new ForbiddenException("You do not have access to this account");
        return account;
    }

    private Eligibility checks(Account account) {
        Integer id = account.getId();
        List<String> archive = new ArrayList<>();
        if (!"ACTIVE".equals(account.getStatus())) archive.add("Account is already archived");
        if (account.getCashBalance().signum() != 0) archive.add("Account contains cash");
        if (accounts.countNonzeroHoldings(id) > 0)
            archive.add("Account contains active holdings");
        // Any nonterminal state blocks, including future pending/triggered/partial states.
        if (accounts.countUnresolvedOrders(id) > 0)
            archive.add("Pending orders must be resolved.");
        return new Eligibility(List.copyOf(archive), List.copyOf(archive));
    }

    private static void require(List<String> blockers) {
        if (!blockers.isEmpty()) throw new AccountStateException(String.join("; ", blockers));
    }

    /**
     * Current reasons operations are unavailable.
     * @param archiveBlockers unmet archive requirements; empty means eligible
     * @param deleteBlockers unmet delete (archive) requirements; empty means eligible
     */
    public record Eligibility(List<String> archiveBlockers, List<String> deleteBlockers) { }
}
