package app.order;

import app.auth.AuthenticatedUser;
import app.order.dto.OrderRequest;
import app.order.dto.OrderResponse;
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
public class OrderController {

    private final OrderService orderService;

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
    public List<OrderResponse> listOwnOrders(@AuthenticationPrincipal Jwt jwt) {
        return orderService.getOwnOrders(AuthenticatedUser.from(jwt).userId()).stream()
                .map(OrderResponse::from)
                .toList();
    }
}
