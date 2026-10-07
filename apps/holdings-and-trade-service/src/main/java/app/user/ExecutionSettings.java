package app.user;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

/** User-wide protection against unfavorable execution prices.
 * @param executionBufferPercent percentage from zero to ten, with two decimal places */
public record ExecutionSettings(@NotNull @DecimalMin("0") @DecimalMax("10")
        @Digits(integer = 2, fraction = 2) BigDecimal executionBufferPercent) { }
