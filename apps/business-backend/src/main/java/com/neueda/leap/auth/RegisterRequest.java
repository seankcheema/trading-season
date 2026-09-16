package com.neueda.leap.auth;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Profile details submitted by the registration form after the account has been
 * created in the auth service.
 *
 * <p>There is no password: credentials belong to the auth service, and the caller
 * is identified by the bearer token instead. The email must match the token's
 * {@code email} claim.
 *
 * @param email          account email address, identical to the token's email claim
 * @param firstName      the registrant's first name
 * @param middleName     the registrant's middle name, optional
 * @param lastName       the registrant's last name
 * @param ssn            social security number in {@code XXX-XX-XXXX} form
 * @param address        the registrant's mailing address
 * @param dateOfBirth    date of birth, must be in the past
 * @param traderLevel    self-assessed experience: BEGINNER, INTERMEDIATE or ADVANCED
 * @param availableFunds opening funds, at least 5000.00 with at most two decimal places
 */
public record RegisterRequest(
        @NotBlank @Email @Size(max = 100) String email,
        @NotBlank String firstName,
        String middleName,
        @NotBlank String lastName,
        @NotBlank @Pattern(regexp = "^\\d{3}-\\d{2}-\\d{4}$", message = "must be in XXX-XX-XXXX format") String ssn,
        @NotBlank String address,
        @NotNull @Past LocalDate dateOfBirth,
        @NotNull @Pattern(regexp = "^(BEGINNER|INTERMEDIATE|ADVANCED)$",
                message = "must be BEGINNER, INTERMEDIATE or ADVANCED") String traderLevel,
        @NotNull @DecimalMin("5000.00") @Digits(integer = 12, fraction = 2) BigDecimal availableFunds
) {
}
