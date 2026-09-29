package app.order.execution;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for accessing Fill entities.
 */
public interface FillRepository extends JpaRepository<Fill, Integer> {
}


