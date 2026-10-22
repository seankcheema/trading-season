package app.registration;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Requires a {@link java.time.LocalDate} date of birth that makes the person at
 * least {@link #value()} years old today. A {@code null} date is valid; pair
 * with {@code @NotNull} to require one.
 */
@Documented
@Constraint(validatedBy = MinimumAgeValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface MinimumAge {

    /**
     * The youngest allowed age, in whole years.
     *
     * @return the minimum age in years
     */
    int value();

    /**
     * The message reported when the person is too young.
     *
     * @return the violation message
     */
    String message() default "must be at least {value} years old";

    /**
     * The validation groups the constraint belongs to.
     *
     * @return the groups
     */
    Class<?>[] groups() default {};

    /**
     * Payload for clients of the Bean Validation API.
     *
     * @return the payload types
     */
    Class<? extends Payload>[] payload() default {};
}
