package app.instrument;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

/**
 * Repository for reading {@link Instrument} entities.
 */
public interface InstrumentRepository extends JpaRepository<Instrument, Integer> {

    /**
     * Loads the instruments with the given ids, for labelling a set of holdings
     * without a query per row.
     *
     * @param instrumentIds the ids to load
     * @return the instruments found; ids with no row are simply absent
     */
    List<Instrument> findByInstrumentIdIn(Collection<Integer> instrumentIds);
}
