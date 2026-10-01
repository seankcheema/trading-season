package app.order;

import app.auth.AuthenticatedUser;
import app.order.dto.OrderRequest;
import app.order.dto.OrderResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST endpoints for orders (KAN-95, KAN-47): submitting one, and reading
 * back the caller's own.
 *
 * <p><b>Known gap:</b> the read endpoint is scoped to the caller by the
 * bearer token's {@code sub}, but submission is not.
 * {@link OrderRequest#accountId()} is still taken from the request body
 * as-is, with no check that the caller owns that account, so a valid token
 * can place an order on someone else's account. Don't build anything
 * downstream that assumes submission is already ownership-checked.
 */
@RestController
@RequestMapping("/api/orders")
@Tag(name = "Orders", description = "Order submission and retrieval endpoints")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    /**
     * Submits a buy or sell order (KAN-93). Always returns 201 with the
     * order's outcome: {@code FILLED} when it executed and the user's
     * available funds moved, or {@code REJECTED} with a reason — a
     * trading-rule rejection is a successful response describing a failed
     * trade, not an HTTP error. See {@link OrderService#submitOrder} for
     * when this throws instead.
     *
     * @param request the order, validated by Bean Validation before this runs
     * @return the order's final status and details
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Submit an order", description = "Submits a buy or sell order and returns the order's outcome (filled or rejected)")
    public OrderResponse submitOrder(@Valid @RequestBody OrderRequest request) {
        Order order = orderService.submitOrder(request);
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
}


