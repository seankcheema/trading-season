package app.account;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.Optional;

/**
 * Consumer group {@value #GROUP_ID}: records a portfolio valuation the moment
 * an order fills, so the portfolio chart gets a point at the time of the
 * trade whether or not a dashboard is open.
 *
 * <p>Order and Sell publishes one message to {@value #TOPIC} per committed
 * order status, keyed by account id. Only {@code FILLED} changes what an
 * account holds, so only that status triggers a capture; accepted and
 * rejected orders are ignored. The capture itself is
 * {@link PortfolioValuationService#capture}, the same call the dashboard makes
 * after placing an order, with the owner resolved from the account row
 * because there is no caller token here.
 *
 * <p>This is derived data, not part of the fill (BR-09): the fill, cash and
 * holdings are already committed before the message exists. A capture that
 * fails is logged and the offset still commits, exactly as the minute
 * scheduler treats a failed account, and a redelivered message only records
 * another observation.
 *
 * <p>Absent when {@code app.events.enabled} is {@code false}.
 */
@Component
@ConditionalOnProperty(name = "app.events.enabled", havingValue = "true", matchIfMissing = true)
public class PortfolioValuationListener {

    /** The topic Order and Sell publishes order status changes to. */
    public static final String TOPIC = "trade-events";

    /** The consumer group this listener commits offsets under. */
    public static final String GROUP_ID = "portfolio-valuation-capture";

    static final String STATUS_FILLED = "FILLED";

    private static final Logger LOG = LoggerFactory.getLogger(PortfolioValuationListener.class);

    private final AccountRepository accounts;
    private final PortfolioValuationService valuations;
    private final ObjectMapper objectMapper;

    /**
     * Creates the listener.
     *
     * @param accounts     resolves the account in the message key to its owner
     * @param valuations   the capture logic shared with the scheduler and the controller
     * @param objectMapper reads the status out of the message body
     */
    public PortfolioValuationListener(AccountRepository accounts,
                                      PortfolioValuationService valuations,
                                      ObjectMapper objectMapper) {
        this.accounts = accounts;
        this.valuations = valuations;
        this.objectMapper = objectMapper;
    }

    /**
     * Records a valuation for the account of a filled order. Never throws.
     *
     * @param record the message, keyed by account id with the JSON event as value
     */
    @KafkaListener(topics = TOPIC, groupId = GROUP_ID)
    public void onTradeEvent(ConsumerRecord<String, String> record) {
        LOG.info("Consumer group {} received key={} partition={} offset={}",
                GROUP_ID, record.key(), record.partition(), record.offset());

        Integer accountId;
        String status;
        try {
            accountId = Integer.valueOf(record.key());
            JsonNode statusNode = objectMapper.readTree(record.value()).get("status");
            status = statusNode == null ? null : statusNode.stringValue();
        } catch (NumberFormatException | JacksonException ex) {
            LOG.warn("Skipping trade event at partition={} offset={}: {}",
                    record.partition(), record.offset(), ex.toString());
            return;
        }

        if (!STATUS_FILLED.equals(status)) {
            LOG.debug("Ignoring {} event for account {}: holdings unchanged", status, accountId);
            return;
        }

        Optional<Account> account = accounts.findById(accountId);
        if (account.isEmpty()) {
            LOG.warn("Skipping fill for unknown account {} at partition={} offset={}",
                    accountId, record.partition(), record.offset());
            return;
        }

        try {
            PortfolioValuationService.Point point = valuations.capture(accountId, account.get().getUserId(), false);
            if (point == null) {
                LOG.info("No valuation recorded for account {}: it has no acquisitions yet", accountId);
            } else {
                LOG.info("Captured portfolio valuation for account {}: {} at {}",
                        accountId, point.value(), point.timestamp());
            }
        } catch (RuntimeException failure) {
            LOG.warn("Portfolio capture after fill failed for account {}", accountId, failure);
        }
    }
}
