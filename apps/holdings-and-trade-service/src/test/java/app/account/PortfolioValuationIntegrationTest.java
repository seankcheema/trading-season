package app.account;

import app.holding.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.WebApplicationContext;
import java.math.BigDecimal;
import java.time.*;
import java.util.UUID;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Tag("integration")
class PortfolioValuationIntegrationTest {
    @Autowired WebApplicationContext context;
    @Autowired AccountRepository accounts;
    @Autowired PortfolioValuationRepository valuations;
    @Autowired HoldingMovementRepository movements;
    @Autowired FillRepository fills;
    private MockMvc http;
    private final UUID owner = UUID.randomUUID();
    private int id;

    @BeforeEach
    public void setup() {
        http = webAppContextSetup(context).apply(springSecurity()).build();
        Account account = new Account();
        account.setUserId(owner);
        account.setName("Portfolio");
        account.setOpenedDate(LocalDate.now());
        account.setCurrency("USD");
        id = accounts.save(account).getId();
    }

    @Test
    void endpointsRejectOtherOwnersAndMissingAccounts() throws Exception {
        for (String path : new String[]{"portfolio-history", "portfolio-valuations"}) {
            var request = path.equals("portfolio-history") ? get("/api/accounts/" + id + "/" + path)
                    : post("/api/accounts/" + id + "/" + path);
            http.perform(request.with(jwt().jwt(token -> token.subject(UUID.randomUUID().toString()))))
                    .andExpect(status().isForbidden());
            var missing = path.equals("portfolio-history") ? get("/api/accounts/2147483647/" + path)
                    : post("/api/accounts/2147483647/" + path);
            http.perform(missing.with(jwt().jwt(token -> token.subject(owner.toString()))))
                    .andExpect(status().isNotFound());
        }
    }

    @Test
    void historyFiltersAccountAndTimeRangeAndPreservesRealTimestamp() throws Exception {
        Instant timestamp = Instant.now().minusSeconds(60);
        valuations.save(new PortfolioValuation(id, timestamp, new BigDecimal("100.50")));
        valuations.save(new PortfolioValuation(id, timestamp.minus(Duration.ofDays(400)), BigDecimal.TEN));
        valuations.save(new PortfolioValuation(id + 1, timestamp, BigDecimal.ONE));
        http.perform(get("/api/accounts/" + id + "/portfolio-history?timeframe=1Y")
                        .with(jwt().jwt(token -> token.subject(owner.toString()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].value").value(100.50));
        http.perform(get("/api/accounts/" + id + "/portfolio-history?timeframe=invalid")
                        .with(jwt().jwt(token -> token.subject(owner.toString()))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void newAccountHasNoHistoryAndNoCaptureUntilAcquisition() throws Exception {
        http.perform(get("/api/accounts/" + id + "/portfolio-history")
                        .with(jwt().jwt(token -> token.subject(owner.toString()))))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
        http.perform(post("/api/accounts/" + id + "/portfolio-valuations")
                        .with(jwt().jwt(token -> token.subject(owner.toString()))))
                .andExpect(status().isOk());
        Assertions.assertTrue(valuations.findFirstByAccountIdOrderByObservedAtDescIdDesc(id).isEmpty());
        Fill fill = new Fill();
        fill.setQuotePrice(BigDecimal.TEN);
        fill.setFilledAt(Instant.now().minusSeconds(120));
        Assertions.assertNotNull(fill.getFilledAt());
        fill = fills.save(fill);
        HoldingMovement movement = new HoldingMovement();
        movement.setAccountId(id);
        movement.setInstrumentId(1);
        movement.setFillId(fill.getFillId());
        movement.setQuantityDelta(BigDecimal.ONE);
        movements.save(movement);
        Assertions.assertTrue(movements.acquiredAccountIds().contains(id));
        Assertions.assertEquals(fill.getFilledAt().toEpochMilli(), movements.firstAcquisitionAt(id).toEpochMilli());
        // Empty current holdings after an acquisition represents a liquidated portfolio.
        http.perform(post("/api/accounts/" + id + "/portfolio-valuations")
                        .with(jwt().jwt(token -> token.subject(owner.toString()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.value").value(0))
                .andExpect(jsonPath("$.timestamp").exists());
    }
}
