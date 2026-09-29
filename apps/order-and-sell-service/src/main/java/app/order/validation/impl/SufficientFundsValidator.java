package app.order.validation.impl;

import app.account.Account;
import app.instrument.Instrument;
import app.order.Order;
import app.order.dto.OrderRequest;
import app.order.validation.OrderValidator;
import app.order.validation.ValidationResult;
import app.user.User;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * BR-09 (KAN-93): a BUY can't cost more than the owning user's available
 * funds. Cash belongs to the user, not to an account — every account shares
 * it — so this checks {@code users.available_funds}, the balance the UI
 * shows, rather than the account's cached cash balance. This is a fast-reject
 * check at validation time; {@code OrderExecutionService} re-checks under a
 * row lock immediately before writing the fill, since two concurrent orders
 * can both pass this check against the same stale balance.
 */
@Component
public class SufficientFundsValidator implements OrderValidator {

    /**
     * Passes every SELL, and every BUY whose {@code quantity * indicativePrice}
     * is no more than {@code user.getAvailableFunds()}.
     *
     * @param request    the order being validated
     * @param user       the account's owner, whose available funds are checked
     * @param account    the account the order is placed against (unused here)
     * @param instrument the instrument being traded (unused here)
     * @return a pass, or a BR-09 rejection when the buy is unaffordable
     */
    @Override
    public ValidationResult validate(OrderRequest request, User user, Account account, Instrument instrument) {
        if (!Order.TYPE_BUY.equals(request.orderType())) {
            return ValidationResult.pass();
        }
        BigDecimal cost = request.quantity().multiply(request.indicativePrice());
        if (cost.compareTo(user.getAvailableFunds()) > 0) {
            return ValidationResult.reject("BR-09: insufficient funds for this order");
        }
        return ValidationResult.pass();
    }
}


