package app.order.event;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * The open order-status streams, one list of server-sent event emitters per
 * signed-in user. {@link OrderStatusStreamController} adds a connection when
 * a client opens {@code GET /api/orders/stream}; {@link OrderStatusPusherListener}
 * sends each committed status change to the owner's connections (BR-07).
 *
 * <p>Nothing is stored. A user with no open connection receives nothing, and
 * reconnecting clients read the order list to catch up. A connection that
 * fails on send is dropped; the servlet container's completion, timeout and
 * error callbacks remove the rest. A heartbeat every
 * {@code app.events.stream.heartbeat-millis} keeps idle connections alive
 * through proxies.
 */
@Component
public class OrderStatusStreamRegistry {

    /** Event name carrying an order status change's JSON body. */
    public static final String EVENT_NAME = "order-status";

    /** Event name of the periodic keep-alive. */
    public static final String HEARTBEAT_NAME = "heartbeat";

    private static final Logger log = LoggerFactory.getLogger(OrderStatusStreamRegistry.class);

    private final Map<UUID, List<SseEmitter>> emitters = new ConcurrentHashMap<>();

    /**
     * Opens a stream for a user. The emitter never times out on its own; the
     * client closes it, or a failed send does.
     *
     * @param userId the signed-in user's id from the token's {@code sub} claim
     * @return the emitter to return from the controller
     */
    public SseEmitter subscribe(UUID userId) {
        return register(userId, new SseEmitter(0L));
    }

    /**
     * Registers an existing emitter for a user. {@link #subscribe(UUID)} is the
     * production entry point; this one lets tests observe what is sent.
     *
     * @param userId  the user the emitter belongs to
     * @param emitter the emitter to register
     * @return the same emitter
     */
    SseEmitter register(UUID userId, SseEmitter emitter) {
        emitters.computeIfAbsent(userId, ignored -> new CopyOnWriteArrayList<>()).add(emitter);
        Runnable cleanup = () -> remove(userId, emitter);
        emitter.onCompletion(cleanup);
        emitter.onTimeout(cleanup);
        emitter.onError(ignored -> cleanup.run());
        log.debug("Order status stream opened for user {} ({} open)", userId, openConnections(userId));
        return emitter;
    }

    /**
     * Sends one order status change to every open connection of its owner.
     *
     * @param userId      the owner of the account the order was placed on
     * @param payloadJson the trade event body exactly as published to Kafka
     * @return how many connections received it; zero when the user has none open
     */
    public int push(UUID userId, String payloadJson) {
        List<SseEmitter> open = emitters.get(userId);
        if (open == null) {
            return 0;
        }
        int delivered = 0;
        for (SseEmitter emitter : open) {
            if (send(userId, emitter, EVENT_NAME, payloadJson)) {
                delivered++;
            }
        }
        return delivered;
    }

    /**
     * Sends a keep-alive to every open connection so idle streams are not
     * closed by proxies. Runs on the application scheduler.
     */
    @Scheduled(fixedRateString = "${app.events.stream.heartbeat-millis:15000}")
    public void heartbeat() {
        emitters.forEach((userId, open) -> open.forEach(emitter -> send(userId, emitter, HEARTBEAT_NAME, "{}")));
    }

    /**
     * Counts a user's open connections.
     *
     * @param userId the user
     * @return the number of registered emitters, zero when none
     */
    public int openConnections(UUID userId) {
        List<SseEmitter> open = emitters.get(userId);
        return open == null ? 0 : open.size();
    }

    private boolean send(UUID userId, SseEmitter emitter, String name, String json) {
        try {
            emitter.send(SseEmitter.event().name(name).data(json));
            return true;
        } catch (IOException | RuntimeException ex) {
            log.debug("Dropping order status stream for user {}: {}", userId, ex.toString());
            remove(userId, emitter);
            try {
                emitter.completeWithError(ex);
            } catch (RuntimeException ignored) {
                // Already completed by the container; nothing left to close.
            }
            return false;
        }
    }

    private void remove(UUID userId, SseEmitter emitter) {
        emitters.computeIfPresent(userId, (ignored, open) -> {
            open.remove(emitter);
            return open.isEmpty() ? null : open;
        });
    }
}
