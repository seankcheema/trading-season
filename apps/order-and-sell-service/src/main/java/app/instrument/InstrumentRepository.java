package app.instrument;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Repository for accessing Instrument entities.
 */
public interface InstrumentRepository extends JpaRepository<Instrument, Integer> {

    /**
     * Lists the whole catalogue in ticker order, for the reference-data
     * endpoint a client uses to turn a symbol into an {@code instrumentId}.
     *
     * @return every instrument, ordered by ticker
     */
    List<Instrument> findAllByOrderByTickerAsc();
}



