package app.instrument;

import app.holding.HoldingRepository;
import app.order.OrderRepository;
import app.order.audit.AuditTrailRepository;
import app.order.execution.CashTransactionRepository;
import app.order.execution.FillRepository;
import app.order.execution.HoldingMovementRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.WebApplicationContext;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

/**
 * Covers {@code GET /api/instruments}, the lookup a client needs to turn the
 * symbol a trader picked into the {@code instrumentId} an order is placed
 * against (DUA-63).
 */
@SpringBootTest
@ActiveProfiles("test")
@Tag("integration")
class InstrumentControllerIntegrationTest {

    @Autowired private WebApplicationContext webApplicationContext;
    @Autowired private InstrumentRepository instrumentRepository;
    @Autowired private AuditTrailRepository auditTrailRepository;
    @Autowired private HoldingMovementRepository holdingMovementRepository;
    @Autowired private CashTransactionRepository cashTransactionRepository;
    @Autowired private FillRepository fillRepository;
    @Autowired private HoldingRepository holdingRepository;
    @Autowired private OrderRepository orderRepository;

    private MockMvc mockMvc;

    @BeforeEach
    public void setUp() {
        mockMvc = webAppContextSetup(webApplicationContext).apply(springSecurity()).build();
        clearInstruments();

        instrumentRepository.save(instrument("ZETA", "Zeta Corp.", true, "ZETA"));
        instrumentRepository.save(instrument("ALFA", "Alfa Holdings", true, null));
        instrumentRepository.save(instrument("HALT", "Halted Industries", false, "HALT"));
    }

    @Test
    void listsEveryInstrumentByTickerWithTheIdAnOrderNeeds() throws Exception {
        mockMvc.perform(get("/api/instruments").with(jwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].ticker").value("ALFA"))
                .andExpect(jsonPath("$[1].ticker").value("HALT"))
                .andExpect(jsonPath("$[2].ticker").value("ZETA"))
                .andExpect(jsonPath("$[2].instrumentId").value(
                        instrumentRepository.findAllByOrderByTickerAsc().get(2).getInstrumentId()))
                .andExpect(jsonPath("$[2].name").value("Zeta Corp."))
                .andExpect(jsonPath("$[2].assetClass").value("Equity"))
                .andExpect(jsonPath("$[2].market").value("US"))
                .andExpect(jsonPath("$[2].currency").value("USD"))
                .andExpect(jsonPath("$[2].simulatedStockSymbol").value("ZETA"));
    }

    @Test
    void reportsNonTradableInstrumentsRatherThanHidingThem() throws Exception {
        // A position can outlive its instrument being suspended, so a client
        // still has to be able to name it; the flag is what it acts on.
        mockMvc.perform(get("/api/instruments").with(jwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].tradable").value(true))
                .andExpect(jsonPath("$[1].ticker").value("HALT"))
                .andExpect(jsonPath("$[1].tradable").value(false));
    }

    @Test
    void reportsAnUnsimulatedInstrumentWithNoMarketSymbol() throws Exception {
        mockMvc.perform(get("/api/instruments").with(jwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].ticker").value("ALFA"))
                .andExpect(jsonPath("$[0].simulatedStockSymbol").value(nullValue()));
    }

    @Test
    void listingInstrumentsRequiresAnAccessToken() throws Exception {
        mockMvc.perform(get("/api/instruments"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void listingInstrumentsIsEmptyBeforeAnyAreLoaded() throws Exception {
        clearInstruments();

        mockMvc.perform(get("/api/instruments").with(jwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    /**
     * Empties the catalogue. Orders, holdings and the ledger rows other suites
     * leave behind reference instruments, so they have to go first.
     */
    private void clearInstruments() {
        auditTrailRepository.deleteAll();
        holdingMovementRepository.deleteAll();
        cashTransactionRepository.deleteAll();
        fillRepository.deleteAll();
        holdingRepository.deleteAll();
        orderRepository.deleteAll();
        instrumentRepository.deleteAll();
    }

    private static Instrument instrument(String ticker, String name, boolean tradable,
                                         String simulatedStockSymbol) {
        Instrument instrument = new Instrument();
        instrument.setTicker(ticker);
        instrument.setName(name);
        instrument.setAssetClass("Equity");
        instrument.setMarket("US");
        instrument.setCurrency("USD");
        instrument.setTradable(tradable);
        instrument.setSimulatedStockSymbol(simulatedStockSymbol);
        return instrument;
    }
}
