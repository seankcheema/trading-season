package app.order.event;

import app.account.Account;
import app.account.AccountRepository;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.json.JsonMapper;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class OrderStatusPusherListenerTest {

    private static final String BODY = "{\"orderId\":7,\"status\":\"FILLED\",\"symbol\":\"TEST\"}";

    @Mock
    private AccountRepository accountRepository;
    @Mock
    private OrderStatusStreamRegistry registry;

    private OrderStatusPusherListener listener;

    @BeforeEach
    void setUp() {
        listener = new OrderStatusPusherListener(accountRepository, registry, new JsonMapper());
    }

    private static ConsumerRecord<String, String> record(String key, String value) {
        return new ConsumerRecord<>(TradeEventPublisher.TOPIC, 0, 0L, key, value);
    }

    @Test
    void pushesTheEventToTheAccountsOwner() {
        UUID owner = UUID.randomUUID();
        Account account = new Account();
        account.setUserId(owner);
        when(accountRepository.findById(42)).thenReturn(Optional.of(account));
        when(registry.push(owner, BODY)).thenReturn(1);

        listener.onTradeEvent(record("42", BODY));

        verify(registry).push(owner, BODY);
    }

    @Test
    void skipsAnEventForAnUnknownAccount() {
        when(accountRepository.findById(42)).thenReturn(Optional.empty());

        assertDoesNotThrow(() -> listener.onTradeEvent(record("42", BODY)));

        verify(registry, never()).push(any(), anyString());
    }

    @Test
    void skipsAnEventWhoseBodyIsNotJson() {
        assertDoesNotThrow(() -> listener.onTradeEvent(record("42", "not json")));

        verify(registry, never()).push(any(), anyString());
    }

    @Test
    void skipsAnEventWhoseKeyIsNotAnAccountId() {
        assertDoesNotThrow(() -> listener.onTradeEvent(record("joanna", BODY)));

        verify(registry, never()).push(any(), anyString());
    }

    @Test
    void commitsUnderItsOwnConsumerGroup() {
        assertEquals("order-status-pusher", OrderStatusPusherListener.GROUP_ID);
    }
}
