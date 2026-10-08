package app.account;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class PortfolioValuationListenerTest {

    private static final String FILLED = "{\"orderId\":7,\"status\":\"FILLED\",\"symbol\":\"TEST\",\"side\":\"BUY\",\"quantity\":10,\"price\":50.00}";
    private static final String ACCEPTED = "{\"orderId\":7,\"status\":\"ACCEPTED\",\"symbol\":\"TEST\",\"side\":\"BUY\"}";
    private static final String REJECTED = "{\"orderId\":8,\"status\":\"REJECTED\",\"rejectionReason\":\"Insufficient holdings\"}";

    @Mock
    private AccountRepository accounts;
    @Mock
    private PortfolioValuationService valuations;

    private final UUID owner = UUID.randomUUID();
    private PortfolioValuationListener listener;

    @BeforeEach
    void setUp() {
        listener = new PortfolioValuationListener(accounts, valuations, new JsonMapper());
    }

    private static ConsumerRecord<String, String> record(String key, String value) {
        return new ConsumerRecord<>(PortfolioValuationListener.TOPIC, 0, 0L, key, value);
    }

    private Account ownedAccount() {
        Account account = new Account();
        account.setUserId(owner);
        return account;
    }

    @Test
    void aFillRecordsAValuationForTheAccountsOwner() {
        when(accounts.findById(42)).thenReturn(Optional.of(ownedAccount()));
        when(valuations.capture(42, owner, false))
                .thenReturn(new PortfolioValuationService.Point(Instant.now(), new BigDecimal("2520.00")));

        listener.onTradeEvent(record("42", FILLED));

        verify(valuations).capture(42, owner, false);
    }

    @Test
    void anAccountWithNoAcquisitionsIsToleratedWhenCaptureReturnsNothing() {
        when(accounts.findById(42)).thenReturn(Optional.of(ownedAccount()));
        when(valuations.capture(42, owner, false)).thenReturn(null);

        assertDoesNotThrow(() -> listener.onTradeEvent(record("42", FILLED)));
    }

    @Test
    void acceptedAndRejectedOrdersDoNotChangeHoldingsSoNothingIsCaptured() {
        listener.onTradeEvent(record("42", ACCEPTED));
        listener.onTradeEvent(record("42", REJECTED));

        verify(accounts, never()).findById(anyInt());
        verify(valuations, never()).capture(anyInt(), any(), anyBoolean());
    }

    @Test
    void aFillForAnUnknownAccountIsSkipped() {
        when(accounts.findById(42)).thenReturn(Optional.empty());

        assertDoesNotThrow(() -> listener.onTradeEvent(record("42", FILLED)));

        verify(valuations, never()).capture(anyInt(), any(), anyBoolean());
    }

    @Test
    void unreadableKeysAndBodiesAreSkipped() {
        listener.onTradeEvent(record("joanna", FILLED));
        listener.onTradeEvent(record("42", "not json"));
        listener.onTradeEvent(record("42", "{\"orderId\":7}"));

        verify(valuations, never()).capture(anyInt(), any(), anyBoolean());
    }

    @Test
    void aFailedCaptureIsLoggedNotThrownSoTheOffsetStillCommits() {
        when(accounts.findById(42)).thenReturn(Optional.of(ownedAccount()));
        when(valuations.capture(42, owner, false)).thenThrow(new IllegalStateException("market data unavailable"));

        assertDoesNotThrow(() -> listener.onTradeEvent(record("42", FILLED)));
    }

    @Test
    void commitsUnderItsOwnConsumerGroup() {
        assertEquals("portfolio-valuation-capture", PortfolioValuationListener.GROUP_ID);
        assertEquals("trade-events", PortfolioValuationListener.TOPIC);
    }
}
