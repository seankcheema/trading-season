package app.order.event;

import app.account.Account;
import app.account.AccountRepository;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import java.util.Optional;

/**
 * Consumer group {@value #GROUP_ID}: forwards each committed order status
 * change to the browser sessions of the account's owner, so an order is seen
 * as accepted and then filled or rejected without a refresh (BR-07).
 *
 * <p>For every message it resolves the account id in the key to the owning
 * user and hands the JSON body to {@link OrderStatusStreamRegistry#push}.
 * Nothing is stored: a user with no open stream simply receives nothing.
 * A message whose key is not an account id, whose body is not JSON, or
 * whose account no longer exists is logged and skipped, never rethrown, so
 * the group keeps consuming and commits its offset.
 *
 * <p>Absent when {@code app.events.enabled} is {@code false}.
 */
@Component
@ConditionalOnProperty(name = "app.events.enabled", havingValue = "true", matchIfMissing = true)
public class OrderStatusPusherListener {

    /** The consumer group this listener commits offsets under. */
    public static final String GROUP_ID = "order-status-pusher";

    private static final Logger log = LoggerFactory.getLogger(OrderStatusPusherListener.class);

    private final AccountRepository accountRepository;
    private final OrderStatusStreamRegistry registry;
    private final ObjectMapper objectMapper;

    /**
     * Creates the listener.
     *
     * @param accountRepository resolves the account in the message key to its owner
     * @param registry          the open order-status streams
     * @param objectMapper      checks that the body is JSON before it is forwarded
     */
    public OrderStatusPusherListener(AccountRepository accountRepository,
                                     OrderStatusStreamRegistry registry,
                                     ObjectMapper objectMapper) {
        this.accountRepository = accountRepository;
        this.registry = registry;
        this.objectMapper = objectMapper;
    }

    /**
     * Forwards one trade event to its owner's open streams.
     *
     * @param record the message, keyed by account id with the JSON event as value
     */
    @KafkaListener(topics = TradeEventPublisher.TOPIC, groupId = GROUP_ID)
    public void onTradeEvent(ConsumerRecord<String, String> record) {
        log.info("Consumer group {} received key={} partition={} offset={} value={}",
                GROUP_ID, record.key(), record.partition(), record.offset(), record.value());

        Integer accountId;
        try {
            accountId = Integer.valueOf(record.key());
            objectMapper.readTree(record.value());
        } catch (NumberFormatException | JacksonException ex) {
            log.warn("Skipping trade event at partition={} offset={}: {}",
                    record.partition(), record.offset(), ex.toString());
            return;
        }

        Optional<Account> account = accountRepository.findById(accountId);
        if (account.isEmpty()) {
            log.warn("Skipping trade event for unknown account {} at partition={} offset={}",
                    accountId, record.partition(), record.offset());
            return;
        }

        int delivered = registry.push(account.get().getUserId(), record.value());
        log.info("Pushed order status for account {} to {} open stream(s)", accountId, delivered);
    }
}
