package app.holding;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for reading {@link Fill} entities.
 *
 * <p>Fills are written by the order service. This service reads them through
 * {@link HoldingMovementRepository}, which joins them to price a position; the
 * repository exists so the entity is managed and can be read directly.
 */
public interface FillRepository extends JpaRepository<Fill, Integer> {
}
