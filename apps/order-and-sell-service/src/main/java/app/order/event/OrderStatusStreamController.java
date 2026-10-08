package app.order.event;

import app.auth.AuthenticatedUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Opens the caller's order-status stream (BR-07). The connection is scoped to
 * the bearer token's {@code sub}, so a client only ever receives outcomes for
 * accounts it owns. Events are named {@value OrderStatusStreamRegistry#EVENT_NAME}
 * and carry the same JSON body that {@link TradeEventPublisher} sends to Kafka;
 * {@value OrderStatusStreamRegistry#HEARTBEAT_NAME} events keep the connection open.
 *
 * <p>The security chain requires a bearer token here as on every other order
 * endpoint. A browser's native {@code EventSource} cannot set that header, so
 * the client either streams through {@code fetch} or the UI story adds another
 * way to present the token.
 */
@RestController
@RequestMapping("/api/orders")
@Tag(name = "Orders", description = "Order submission and retrieval endpoints")
public class OrderStatusStreamController {

    private final OrderStatusStreamRegistry registry;

    /**
     * Creates the controller.
     *
     * @param registry holds the open streams
     */
    public OrderStatusStreamController(OrderStatusStreamRegistry registry) {
        this.registry = registry;
    }

    /**
     * Opens a server-sent events stream of the caller's order outcomes.
     *
     * @param jwt the verified access token identifying the caller
     * @return the open emitter; stays open until the client disconnects
     */
    @Operation(summary = "Stream order status changes",
            description = "Server-sent events for the caller's own orders, fed by the order-status-pusher consumer of the "
                    + "Kafka topic trade-events. Each committed status change (ACCEPTED, FILLED, REJECTED) arrives as an "
                    + "order-status event whose JSON data holds orderId, status, symbol, side, quantity, price, rejectionReason "
                    + "and occurredAt; a heartbeat event is sent every 15 seconds. The bearer header is required, which a "
                    + "browser's native EventSource cannot send.")
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@AuthenticationPrincipal Jwt jwt) {
        return registry.subscribe(AuthenticatedUser.from(jwt).userId());
    }
}
