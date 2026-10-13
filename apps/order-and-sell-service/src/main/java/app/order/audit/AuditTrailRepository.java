package app.order.audit;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Repository for accessing AuditTrail entities. Insert/select only — see
 * the class-level note on {@link AuditTrail}.
 */
public interface AuditTrailRepository extends JpaRepository<AuditTrail, Integer> {

    /**
     * Returns one order's lifecycle entries in the order in which they were
     * recorded. The audit id breaks a timestamp tie deterministically.
     *
     * @param orderId the order whose audit entries to read
     * @return the order's audit entries, oldest first
     */
    List<AuditTrail> findAllByOrderIdOrderByRecordedAtAscAuditIdAsc(Integer orderId);
}

