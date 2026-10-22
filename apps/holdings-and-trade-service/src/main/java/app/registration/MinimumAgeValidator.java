package app.registration;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.time.LocalDate;

/**
 * Checks a {@link MinimumAge} constraint: the date of birth plus the minimum
 * number of years must not be after today, so the birthday itself counts.
 */
public class MinimumAgeValidator implements ConstraintValidator<MinimumAge, LocalDate> {

    private int minimumYears;

    /** Creates an instance of this class. */
    public MinimumAgeValidator() {
    }

    @Override
    public void initialize(MinimumAge constraint) {
        this.minimumYears = constraint.value();
    }

    /**
     * Tells whether the person born on the date is old enough today.
     *
     * @param dateOfBirth the date of birth, or {@code null}
     * @param context     the validation context, unused
     * @return {@code true} for {@code null} or a date at least the minimum number of years ago
     */
    @Override
    public boolean isValid(LocalDate dateOfBirth, ConstraintValidatorContext context) {
        return dateOfBirth == null || !dateOfBirth.plusYears(minimumYears).isAfter(LocalDate.now());
    }
}
