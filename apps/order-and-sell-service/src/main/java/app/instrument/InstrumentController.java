package app.instrument;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Read-only instrument reference data (DUA-63).
 *
 * <p>This exists so a client can submit an order at all: the order endpoint
 * takes an {@code instrumentId}, and nothing else in the API hands one out.
 * Market data is keyed by symbol and holdings come back by symbol, so without
 * this a UI has a symbol and no way to name the instrument behind it.
 *
 * <p>The catalogue is the same for every caller — there is nothing
 * user-specific here — but a token is still required, in keeping with every
 * endpoint outside the public market reads.
 */
@RestController
@RequestMapping("/api/instruments")
public class InstrumentController {

    private final InstrumentRepository instrumentRepository;

    /**
     * Creates the controller.
     *
     * @param instrumentRepository source of instrument reference data
     */
    public InstrumentController(InstrumentRepository instrumentRepository) {
        this.instrumentRepository = instrumentRepository;
    }

    /**
     * Lists every instrument, by ticker. Non-tradable instruments are included
     * and flagged rather than hidden: a position can outlive its instrument
     * being suspended, and a client still has to name the instrument to
     * display that holding.
     *
     * @return the full catalogue, ordered by ticker
     */
    @GetMapping
    public List<InstrumentResponse> listInstruments() {
        return instrumentRepository.findAllByOrderByTickerAsc().stream()
                .map(InstrumentResponse::from)
                .toList();
    }
}
