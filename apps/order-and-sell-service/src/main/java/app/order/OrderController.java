package app.order;

import app.auth.AuthenticatedUser;
import app.order.dto.OrderRequest;
import app.order.dto.OrderAuditEntryResponse;
import app.order.dto.OrderResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST endpoints for orders (KAN-95, KAN-47, DUA-63): submitting one, and
 * reading back the caller's own.
 *
 * <p>Both endpoints are scoped to the bearer token's {@code sub}. Submission
 * still takes {@link OrderRequest#accountId()} from the request body, because
 * a user may own several accounts and has to say which one the order is for,
 * but {@link OrderService#submitOrder} now refuses an account the caller does
 * not own, so the body can no longer name someone else's account.
 */
@RestController
@RequestMapping("/api/orders")
@Tag(name = "Orders", description = "Order submission and retrieval endpoints")
public class OrderController {

    private final OrderService orderService;

    /**
     * Creates the controller.
     *
     * @param orderService order submission and history logic
     */
    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    /**
     * Submits a buy or sell order (KAN-93). Returns 201 with the order's
     * outcome: {@code FILLED} when it executed and the user's available funds
     * moved, or {@code REJECTED} with a reason — a trading-rule rejection is a
     * successful response describing a failed trade, not an HTTP error. See
     * {@link OrderService#submitOrder} for when this throws instead.
     *
     * @param request the order, validated by Bean Validation before this runs
     * @param jwt     the verified access token identifying the caller
     * @return the order's final status and details
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Submit an order", description = "Submits a buy or sell order and returns its outcome: "
            + "FILLED, REJECTED, or ACCEPTED while conditions are unmet or settlement is retryable. "
            + "Each committed status change is also published to the Kafka topic trade-events and pushed to the caller's "
            + "open GET /api/orders/stream connections.")
    public OrderResponse submitOrder(@Valid @RequestBody OrderRequest request,
                                     @AuthenticationPrincipal Jwt jwt) {
        Order order = orderService.submitOrder(request, AuthenticatedUser.from(jwt).userId());
        return OrderResponse.from(order);
    }

    /**
     * Lists the caller's own orders, newest submission first. The owner is
     * resolved from the bearer token, so there is no path or query parameter
     * that can name another user's orders. A caller with no orders gets an
     * empty array, not a 404.
     *
     * @param jwt the verified access token
     * @return the caller's orders across every account they own
     */
    @GetMapping
    @Operation(summary = "List user orders", description = "Retrieves all orders submitted by the authenticated user, newest first")
    public List<OrderResponse> listOwnOrders(@AuthenticationPrincipal Jwt jwt) {
        return orderService.getOwnOrders(AuthenticatedUser.from(jwt).userId()).stream()
                .map(OrderResponse::from)
                .toList();
    }

    /**
     * Lists the immutable lifecycle audit trail for one of the caller's
     * orders. Entries are oldest first so a client can render the progression
     * from PENDING through its current status. A missing order and an order
     * belonging to a different caller both return 404.
     *
     * @param orderId the requested order id
     * @param jwt the verified access token identifying the caller
     * @return audit entries with the order price and their real record times
     */
    @GetMapping("/{orderId}/audit")
    @Operation(summary = "Get an order audit trail", description = "Retrieves the authenticated caller's order lifecycle entries, oldest first")
    public List<OrderAuditEntryResponse> getOwnOrderAudit(@PathVariable Integer orderId,
                                                           @AuthenticationPrincipal Jwt jwt) {
        Order order = orderService.getOwnOrder(orderId, AuthenticatedUser.from(jwt).userId());
        return orderService.getOwnOrderAudit(orderId, AuthenticatedUser.from(jwt).userId()).stream()
                .map(entry -> OrderAuditEntryResponse.from(entry, order.getIndicativePrice()))
                .toList();
    }
    /** Reads one owned instruction.
     * @param orderId order identifier
     * @param jwt verified caller
     * @return current order */
    @GetMapping("/{orderId}")
    @Operation(summary = "Get an owned order")
    public OrderResponse getOrder(@PathVariable Integer orderId, @AuthenticationPrincipal Jwt jwt) {
        return OrderResponse.from(orderService.getOwnOrder(orderId, AuthenticatedUser.from(jwt).userId()));
    }
    /** Cancels an owned open instruction.
     * @param orderId order identifier
     * @param jwt verified caller
     * @return cancelled order */
    @PostMapping("/{orderId}/cancel")
    @Operation(summary = "Cancel an open order")
    public OrderResponse cancel(@PathVariable Integer orderId, @AuthenticationPrincipal Jwt jwt) {
        return OrderResponse.from(orderService.cancel(orderId, AuthenticatedUser.from(jwt).userId()));
    }    /** Replaces an owned open order without losing it on validation failure.
     * @param orderId original order
     * @param request validated replacement instruction
     * @param jwt verified caller
     * @return replacement outcome */
    @PostMapping("/{orderId}/replace")
    @Operation(summary = "Edit an open order by atomic replacement")
    public OrderResponse replace(@PathVariable Integer orderId, @jakarta.validation.Valid @org.springframework.web.bind.annotation.RequestBody OrderRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        return OrderResponse.from(orderService.replace(orderId, request, AuthenticatedUser.from(jwt).userId()));
    }

}
