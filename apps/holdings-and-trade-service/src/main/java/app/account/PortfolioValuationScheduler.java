package app.account;

import app.holding.HoldingMovementRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Records account valuations even when no dashboard is open. */
@Component
public class PortfolioValuationScheduler {
    private static final Logger LOG = LoggerFactory.getLogger(PortfolioValuationScheduler.class);
    private final HoldingMovementRepository movements;
    private final AccountRepository accounts;
    private final PortfolioValuationService service;
    /**
     * Creates the background recorder.
     * @param movements acquisition ledger identifying eligible accounts
     * @param accounts account ownership
     * @param service transactional capture logic
     */
    public PortfolioValuationScheduler(HoldingMovementRepository movements, AccountRepository accounts,
            PortfolioValuationService service) {
        this.movements = movements;
        this.accounts = accounts;
        this.service = service;
    }

    /** Captures independently per account; a failed account is retried next minute. */
    @Scheduled(fixedDelay = 60000, initialDelay = 60000)
    public void captureAccounts() {
        for (Integer id : movements.acquiredAccountIds()) {
            try {
                accounts.findById(id).filter(account -> account.getArchivedAt() == null).ifPresent(account -> service.capture(id, account.getUserId(), true));
            } catch (RuntimeException failure) {
                LOG.warn("Portfolio capture failed for account {}", id, failure);
            }
        }
    }
}
