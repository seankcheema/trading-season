package app.order.event;

import app.account.Account;
import app.account.AccountRepository;
import app.holding.HoldingRepository;
import app.instrument.Instrument;
import app.instrument.InstrumentRepository;
import app.order.Order;
import app.order.OrderRepository;
import app.order.OrderService;
import app.order.audit.AuditTrailRepository;
import app.order.dto.OrderRequest;
import app.order.execution.CashTransactionRepository;
import app.order.execution.FillRepository;
import app.order.execution.HoldingMovementRepository;
import app.support.UserAccountFixture;
import app.user.User;
import app.user.UserRepository;
import org.apache.kafka.clients.consumer.Consumer;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.kafka.config.KafkaListenerEndpointRegistry;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.listener.MessageListenerContainer;
import org.springframework.kafka.test.EmbeddedKafkaBroker;
import org.springframework.kafka.test.context.EmbeddedKafka;
import org.springframework.kafka.test.utils.ContainerTestUtils;
import org.springframework.kafka.test.utils.KafkaTestUtils;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Runs the real path from {@code OrderService} through the after-commit
 * publisher to an embedded broker and back through both consumer groups.
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
        "spring.datasource.url=jdbc:h2:mem:trade-events;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE"
})
@ActiveProfiles("test")
@EmbeddedKafka(partitions = 3, topics = TradeEventPublisher.TOPIC)
@ExtendWith(OutputCaptureExtension.class)
@Tag("integration")
class TradeEventFlowIntegrationTest {

    @Autowired
    private OrderService orderService;
    @Autowired
    private OrderRepository orderRepository;
    @Autowired
    private AccountRepository accountRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private InstrumentRepository instrumentRepository;
    @Autowired
    private HoldingRepository holdingRepository;
    @Autowired
    private FillRepository fillRepository;
    @Autowired
    private CashTransactionRepository cashTransactionRepository;
    @Autowired
    private HoldingMovementRepository holdingMovementRepository;
    @Autowired
    private AuditTrailRepository auditTrailRepository;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private EmbeddedKafkaBroker broker;
    @Autowired
    private KafkaListenerEndpointRegistry listeners;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private OrderStatusStreamRegistry streams;

    private User user;
    private Account account;
    private Instrument instrument;

    @BeforeEach
    void setUp() {
        auditTrailRepository.deleteAll();
        holdingMovementRepository.deleteAll();
        cashTransactionRepository.deleteAll();
        fillRepository.deleteAll();
        holdingRepository.deleteAll();
        orderRepository.deleteAll();
        accountRepository.deleteAll();
        userRepository.deleteAll();
        instrumentRepository.deleteAll();
        UserAccountFixture.deleteAll(jdbcTemplate);

        UUID userId = UUID.randomUUID();
        UserAccountFixture.createActiveAccount(jdbcTemplate, userId, "trader@example.com");

        user = new User();
        user.setUserId(userId);
        user.setFirstName("Test");
        user.setLastName("User");
        user.setSsn("123-45-6789");
        user.setAddress("123 Test St");
        user.setDateOfBirth(LocalDate.of(1990, 1, 1));
        user.setExecutionBufferPercent(new BigDecimal("5.0"));
        user.setAvailableFunds(new BigDecimal("100000.00"));
        user.setCreatedAt(OffsetDateTime.now());
        user = userRepository.save(user);

        account = new Account();
        account.setUserId(user.getUserId());
        account.setOpenedDate(LocalDate.now());
        account.setCashBalance(BigDecimal.ZERO);
        account = accountRepository.save(account);

        instrument = new Instrument();
        instrument.setTicker("TEST");
        instrument.setName("Test Instrument");
        instrument.setAssetClass("EQUITY");
        instrument.setCurrency("USD");
        instrument.setTradable(true);
        instrument = instrumentRepository.save(instrument);

        // Both consumer groups must own all three partitions before an order is
        // placed, or an event could be published before anyone is subscribed.
        for (MessageListenerContainer container : listeners.getListenerContainers()) {
            ContainerTestUtils.waitForAssignment(container, 3);
        }
    }

    private OrderRequest order(String orderType, String quantity, String price) {
        return new OrderRequest(account.getAccountId(), instrument.getInstrumentId(), orderType,
                new BigDecimal(quantity), new BigDecimal(price), new BigDecimal("2.0"), UUID.randomUUID());
    }

    @Test
    void eachResolvedOrderIsPublishedOnceInOrderOnTheAccountsPartitionAndSeenByBothGroups(
            CapturedOutput output) {
        // The owner has the dashboard open: the pusher must deliver both outcomes here.
        RecordingSseEmitter browser = new RecordingSseEmitter();
        streams.register(user.getUserId(), browser);

        Order filled = orderService.submitOrder(order("BUY", "100", "50.00"), user.getUserId());
        // Sells more than the 100 just bought, so the rule pipeline rejects it.
        Order rejected = orderService.submitOrder(order("SELL", "500", "50.00"), user.getUserId());
        assertEquals(Order.STATUS_FILLED, filled.getStatus());
        assertEquals(Order.STATUS_REJECTED, rejected.getStatus());

        List<ConsumerRecord<String, String>> records = readTwoRecords();
        String key = String.valueOf(account.getAccountId());
        ConsumerRecord<String, String> first = records.get(0);
        ConsumerRecord<String, String> second = records.get(1);

        assertEquals(key, first.key());
        assertEquals(key, second.key());
        assertEquals(first.partition(), second.partition(), "one account's events share a partition");
        assertEquals(first.offset() + 1, second.offset(), "consecutive offsets in submission order");

        JsonNode filledBody = objectMapper.readTree(first.value());
        assertEquals(filled.getOrderId().intValue(), filledBody.get("orderId").intValue());
        assertEquals("FILLED", filledBody.get("status").stringValue());
        assertEquals("TEST", filledBody.get("symbol").stringValue());
        assertEquals("BUY", filledBody.get("side").stringValue());
        assertEquals(0, new BigDecimal("50.00").compareTo(filledBody.get("price").decimalValue()));
        assertTrue(filledBody.get("rejectionReason").isNull());
        assertTrue(filledBody.get("accountId") == null, "the account id travels as the key only");

        JsonNode rejectedBody = objectMapper.readTree(second.value());
        assertEquals(rejected.getOrderId().intValue(), rejectedBody.get("orderId").intValue());
        assertEquals("REJECTED", rejectedBody.get("status").stringValue());
        assertEquals("SELL", rejectedBody.get("side").stringValue());
        assertEquals(rejected.getRejectionReason(), rejectedBody.get("rejectionReason").stringValue());

        await().atMost(Duration.ofSeconds(20)).untilAsserted(() -> {
            String log = output.getAll();
            for (Order order : List.of(filled, rejected)) {
                String published = "Published trade event orderId=" + order.getOrderId();
                assertTrue(log.contains(published), published);
            }
            assertTrue(log.contains("partition=" + first.partition() + " offset=" + first.offset()));
            assertTrue(log.contains("partition=" + second.partition() + " offset=" + second.offset()));
            for (ConsumerRecord<String, String> record : records) {
                String received = "Consumer group " + OrderStatusPusherListener.GROUP_ID + " received key=" + key
                        + " partition=" + record.partition() + " offset=" + record.offset();
                assertTrue(log.contains(received), received);
            }

            List<String> pushed = browser.framesNamed(OrderStatusStreamRegistry.EVENT_NAME);
            assertEquals(2, pushed.size(), "one order-status event per resolved order");
            assertTrue(pushed.get(0).contains("\"orderId\":" + filled.getOrderId()), pushed.get(0));
            assertTrue(pushed.get(1).contains("\"orderId\":" + rejected.getOrderId()), pushed.get(1));
        });
    }

    private List<ConsumerRecord<String, String>> readTwoRecords() {
        Map<String, Object> props = KafkaTestUtils.consumerProps(broker, "trade-events-assert", false);
        try (Consumer<String, String> consumer = new DefaultKafkaConsumerFactory<>(
                props, new StringDeserializer(), new StringDeserializer()).createConsumer()) {
            broker.consumeFromAnEmbeddedTopic(consumer, TradeEventPublisher.TOPIC);
            List<ConsumerRecord<String, String>> records = new ArrayList<>();
            KafkaTestUtils.getRecords(consumer, Duration.ofSeconds(10), 2).forEach(records::add);
            records.sort(Comparator.comparingLong(ConsumerRecord::offset));
            assertEquals(2, records.size(), "exactly one message per resolved order");
            return records;
        }
    }
}
