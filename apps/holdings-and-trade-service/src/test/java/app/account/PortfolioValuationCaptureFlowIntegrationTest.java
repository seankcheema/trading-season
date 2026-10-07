package app.account;

import app.holding.Fill;
import app.holding.FillRepository;
import app.holding.HoldingMovement;
import app.holding.HoldingMovementRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.kafka.config.KafkaListenerEndpointRegistry;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.MessageListenerContainer;
import org.springframework.kafka.test.context.EmbeddedKafka;
import org.springframework.kafka.test.utils.ContainerTestUtils;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Runs a trade event through an embedded broker into the
 * portfolio-valuation-capture group and checks that a fill, and only a fill,
 * leaves a valuation row for the account.
 *
 * <p>This is the one context with {@code app.events.enabled=true}. The
 * embedded broker also sets {@code spring.kafka.bootstrap-servers} as a JVM
 * system property for every context created afterwards in the same test
 * run; that is harmless because those contexts have events disabled and
 * never open a connection.
 */
@SpringBootTest(properties = {
        "app.events.enabled=true",
        // Own database name, so this context's create-drop cannot touch the
        // schema the other cached contexts share.
        "spring.datasource.url=jdbc:h2:mem:valuation-capture;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE"
})
@ActiveProfiles("test")
@EmbeddedKafka(partitions = 3, topics = PortfolioValuationListener.TOPIC)
@ExtendWith(OutputCaptureExtension.class)
@Tag("integration")
class PortfolioValuationCaptureFlowIntegrationTest {

    @Autowired
    private AccountRepository accounts;
    @Autowired
    private PortfolioValuationRepository valuations;
    @Autowired
    private HoldingMovementRepository movements;
    @Autowired
    private FillRepository fills;
    @Autowired
    private KafkaTemplate<String, String> kafka;
    @Autowired
    private KafkaListenerEndpointRegistry listeners;

    private int accountId;

    @BeforeEach
    void setUp() {
        // An account that has bought once, so capture() returns a point (value 0:
        // the position was liquidated, but the acquisition makes it eligible).
        Account account = new Account();
        account.setUserId(UUID.randomUUID());
        account.setName("Growth");
        account.setOpenedDate(LocalDate.now());
        account.setCurrency("USD");
        accountId = accounts.save(account).getId();

        Fill fill = new Fill();
        fill.setQuotePrice(BigDecimal.TEN);
        fill.setFilledAt(Instant.now().minusSeconds(120));
        fill = fills.save(fill);
        HoldingMovement movement = new HoldingMovement();
        movement.setAccountId(accountId);
        movement.setInstrumentId(1);
        movement.setFillId(fill.getFillId());
        movement.setQuantityDelta(BigDecimal.ONE);
        movements.save(movement);

        // The group must own all three partitions before anything is published.
        for (MessageListenerContainer container : listeners.getListenerContainers()) {
            ContainerTestUtils.waitForAssignment(container, 3);
        }
    }

    private List<PortfolioValuation> valuationsForAccount() {
        return valuations.findByAccountIdAndObservedAtBetweenOrderByObservedAtAscIdAsc(
                accountId, Instant.EPOCH, Instant.now().plusSeconds(60));
    }

    private void publish(String status, int orderId) throws Exception {
        String body = "{\"orderId\":" + orderId + ",\"status\":\"" + status + "\",\"symbol\":\"TEST\",\"side\":\"BUY\","
                + "\"quantity\":10,\"price\":50.00,\"rejectionReason\":null,\"occurredAt\":\"" + Instant.now() + "\"}";
        kafka.send(PortfolioValuationListener.TOPIC, String.valueOf(accountId), body).get();
    }

    @Test
    void aFillRecordsOneValuationAndOtherStatusesRecordNone(CapturedOutput output) throws Exception {
        assertTrue(valuationsForAccount().isEmpty());

        publish("ACCEPTED", 7);
        publish("FILLED", 7);

        await().atMost(Duration.ofSeconds(20)).untilAsserted(() -> {
            assertTrue(output.getAll().contains("Captured portfolio valuation for account " + accountId));
            assertEquals(1, valuationsForAccount().size(), "one row for the fill, none for the acceptance");
        });

        publish("REJECTED", 8);

        await().atMost(Duration.ofSeconds(20)).untilAsserted(() ->
                assertTrue(output.getAll().contains("received key=" + accountId + " partition=")
                        && output.getAll().split("Consumer group " + PortfolioValuationListener.GROUP_ID + " received").length >= 4,
                        "all three messages were received"));
        assertEquals(1, valuationsForAccount().size(), "a rejection records nothing");
        assertEquals(0, BigDecimal.ZERO.compareTo(valuationsForAccount().get(0).getValue()));
    }
}
