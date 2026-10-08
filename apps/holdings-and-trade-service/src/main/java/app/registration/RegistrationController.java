package app.registration;

import app.auth.AuthenticatedUser;
import app.auth.ConflictException;
import app.auth.ForbiddenException;
import app.user.User;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST endpoints for business account registration and the soft account
 * existence check, under {@code /api/registration}. Sign-in is handled by the
 * auth service, not here.
 */
@RestController
@RequestMapping("/api/registration")
@Tag(name = "Registration", description = "Profile registration and account-existence check; sign-in is handled by the auth service")
public class RegistrationController {

    private final RegistrationService registrationService;

    /**
     * Creates the controller.
     *
     * @param registrationService registration and account lookup logic
     */
    public RegistrationController(RegistrationService registrationService) {
        this.registrationService = registrationService;
    }

    /**
     * Registers the business account for the caller identified by the bearer token.
     *
     * @param jwt     the verified access token
     * @param request the profile details from the registration form
     * @return the created account's id and email
     * @throws ForbiddenException if the request email differs from the token's email
     * @throws ConflictException  if the account already exists
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Register business account", description = "Registers a business account for an authenticated user")
    public RegistrationResponse register(@AuthenticationPrincipal Jwt jwt,
                                         @Valid @RequestBody RegistrationRequest request) {
        AuthenticatedUser caller = AuthenticatedUser.from(jwt);
        User user = registrationService.register(caller, request);
        // The profile row no longer stores an email. register() has already
        // checked that the token claim and the request agree, so either is the
        // same value; the token is the one that is authoritative.
        return new RegistrationResponse(user.getUserId(), caller.email());
    }

    /**
     * Reports whether a business account is registered with the email. Does not
     * require a token.
     *
     * @param request the email to check
     * @return whether an account exists
     */
    @PostMapping("/account-exists")
    @Operation(summary = "Check if account exists", description = "Verifies whether a business account is registered with the given email (no authentication required)")
    public AccountExistsResponse accountExists(@Valid @RequestBody AccountExistsRequest request) {
        return new AccountExistsResponse(registrationService.accountExists(request.email()));
    }
}


