package app.order.validation.impl;

import app.account.Account;
import app.instrument.Instrument;
import app.order.dto.OrderRequest;
import app.order.execution.ExecutionPolicy;
import app.order.validation.OrderValidator;
import app.order.validation.ValidationResult;
import app.user.User;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;

/**
 * BR-05: an order placed while the market is closed is rejected. The market
 * is the simulated session every instrument trades on: Monday to Friday,
 * 08:30 to 15:00 America/Chicago, the hours the replay serves quotes for and
 * the close a day order expires at (see {@link ExecutionPolicy}).
 *
 * <p>The time checked is the authoritative submission position, which
 * {@code OrderService} passes to the rules as {@code simulatedAt} in place
 * of the client's display time. A request without one passes: it comes from
 * a caller that never read a quote, and the quote source is what decides
 * whether such an order can be priced at all.
 */
@Component
public class MarketHoursValidator implements OrderValidator {

    private static final DateTimeFormatter LOCAL_TIME = DateTimeFormatter.ofPattern("EEEE HH:mm");

    /** Creates an instance of this class. */
    public MarketHoursValidator() {
    }

    @Override
    public ValidationResult validate(OrderRequest request, User user, Account account, Instrument instrument) {
        OffsetDateTime at = request.simulatedAt();
        if (at == null || ExecutionPolicy.isDuringSession(at)) {
            return ValidationResult.pass();
        }
        return ValidationResult.reject("BR-05: the market is closed at "
                + at.atZoneSameInstant(ExecutionPolicy.MARKET_ZONE).format(LOCAL_TIME)
                + " America/Chicago; orders are accepted Monday to Friday 08:30 to 15:00");
    }
}
