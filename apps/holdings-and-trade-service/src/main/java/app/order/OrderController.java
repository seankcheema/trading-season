package app.order;

import app.order.dto.OrderRequest;
import app.order.dto.OrderResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST endpoint for order submission (KAN-95, KAN-47).
 *
 * <p><b>Known gap:</b> this controller does not yet resolve the caller from
 * an authenticated session — business-backend has no request-time identity
 * check at all today (no {@code SecurityFilterChain}/filter reads the
 * {@code session_id} the auth service issues),
 * and a separate {@code auth-service} issuing real JWTs exists alongside it
 * marked "WIP" in the root README. Until the team decides which of those
 * this endpoint should trust, {@link OrderRequest#accountId()} is taken
 * from the request body as-is, with no ownership check. Don't build
 * anything downstream that assumes this is already secure.
 */
@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    /**
     * Submits an order. Always returns 201 with the order's outcome — a
     * trading-rule rejection is a successful response describing a failed
     * trade, not an HTTP error. See {@link OrderService#submitOrder} for
     * when this throws instead.
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse submitOrder(@Valid @RequestBody OrderRequest request) {
        Order order = orderService.submitOrder(request);
        return OrderResponse.from(order);
    }
}


