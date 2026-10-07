package app.order.execution;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for accessing Fill entities.
 */
public interface FillRepository extends JpaRepository<Fill, Integer> {
    /** Loads an order's sole fill.
     * @param orderId order identifier
     * @return fill if executed */
    java.util.Optional<Fill> findByOrderId(Integer orderId);

}


