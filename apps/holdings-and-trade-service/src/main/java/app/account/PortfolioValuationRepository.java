package app.account;

import org.springframework.data.jpa.repository.JpaRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/** Reads and appends portfolio observations. */
public interface PortfolioValuationRepository extends JpaRepository<PortfolioValuation, Long> {
    /**
     * Reads an account's most recent observation.
     * @param accountId observed account
     * @return latest observation, or empty before capture starts
     */
    Optional<PortfolioValuation> findFirstByAccountIdOrderByObservedAtDescIdDesc(Integer accountId);

    /**
     * Reads observed history without filling missing intervals.
     * @param accountId observed account
     * @param start inclusive lookback boundary
     * @param end inclusive real-time boundary
     * @return chronological observations within the requested range
     */
    List<PortfolioValuation> findByAccountIdAndObservedAtBetweenOrderByObservedAtAscIdAsc(
            Integer accountId, Instant start, Instant end);
}
