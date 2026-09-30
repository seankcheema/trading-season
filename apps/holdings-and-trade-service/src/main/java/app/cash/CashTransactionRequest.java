package app.cash;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.math.BigDecimal;

/**
 * Request DTO for a deposit or withdrawal.
 *
 * <p>The amount is always positive; {@code reason} gives the direction. The
 * caller never names an account: cash belongs to the user, and the service
 * resolves the account the ledger row is booked against.
 *
 * @param amount how much to move, in whole cents, greater than 0
 * @param reason {@code DEPOSIT} or {@code WITHDRAWAL}
 */
public record CashTransactionRequest(
        @NotNull(message = "must be greater than 0")
        @DecimalMin(value = "0.01", message = "must be greater than 0")
        @DecimalMax(value = "1000000", message = "must not exceed 1000000")
        @Digits(integer = 7, fraction = 2, message = "must be in whole cents")
        BigDecimal amount,

        @NotNull(message = "must be DEPOSIT or WITHDRAWAL")
        @Pattern(regexp = "DEPOSIT|WITHDRAWAL", message = "must be DEPOSIT or WITHDRAWAL")
        String reason
) {
}
