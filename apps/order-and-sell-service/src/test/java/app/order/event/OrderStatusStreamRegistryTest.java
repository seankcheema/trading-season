package app.order.event;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("unit")
class OrderStatusStreamRegistryTest {

    private static final String PAYLOAD = "{\"orderId\":7,\"status\":\"FILLED\"}";

    private final UUID joanna = UUID.randomUUID();
    private final UUID david = UUID.randomUUID();
    private OrderStatusStreamRegistry registry;

    @BeforeEach
    void setUp() {
        registry = new OrderStatusStreamRegistry();
    }

    @Test
    void subscribeOpensAConnectionForTheUser() {
        assertNotNull(registry.subscribe(joanna));

        assertEquals(1, registry.openConnections(joanna));
        assertEquals(0, registry.openConnections(david));
    }

    @Test
    void pushReachesOnlyTheOwnersConnections() {
        RecordingSseEmitter joannaLaptop = new RecordingSseEmitter();
        RecordingSseEmitter joannaPhone = new RecordingSseEmitter();
        RecordingSseEmitter davidDesk = new RecordingSseEmitter();
        registry.register(joanna, joannaLaptop);
        registry.register(joanna, joannaPhone);
        registry.register(david, davidDesk);

        int delivered = registry.push(joanna, PAYLOAD);

        assertEquals(2, delivered);
        for (RecordingSseEmitter emitter : new RecordingSseEmitter[] {joannaLaptop, joannaPhone}) {
            assertEquals(1, emitter.framesNamed(OrderStatusStreamRegistry.EVENT_NAME).size());
            assertTrue(emitter.frames().get(0).contains("data:" + PAYLOAD), emitter.frames().get(0));
        }
        assertTrue(davidDesk.frames().isEmpty());
    }

    @Test
    void pushToAUserWithNoConnectionDeliversNothing() {
        assertEquals(0, registry.push(joanna, PAYLOAD));
    }

    @Test
    void aConnectionThatFailsOnSendIsDropped() {
        RecordingSseEmitter healthy = new RecordingSseEmitter();
        RecordingSseEmitter broken = new RecordingSseEmitter(true);
        registry.register(joanna, healthy);
        registry.register(joanna, broken);

        assertEquals(1, registry.push(joanna, PAYLOAD));
        assertEquals(1, registry.openConnections(joanna));

        // The broken one is gone, so the next push reaches only the healthy connection.
        assertEquals(1, registry.push(joanna, PAYLOAD));
        assertEquals(2, healthy.frames().size());
    }

    @Test
    void heartbeatReachesEveryOpenConnection() {
        RecordingSseEmitter joannaLaptop = new RecordingSseEmitter();
        RecordingSseEmitter davidDesk = new RecordingSseEmitter();
        registry.register(joanna, joannaLaptop);
        registry.register(david, davidDesk);

        registry.heartbeat();

        assertEquals(1, joannaLaptop.framesNamed(OrderStatusStreamRegistry.HEARTBEAT_NAME).size());
        assertEquals(1, davidDesk.framesNamed(OrderStatusStreamRegistry.HEARTBEAT_NAME).size());
    }
}
