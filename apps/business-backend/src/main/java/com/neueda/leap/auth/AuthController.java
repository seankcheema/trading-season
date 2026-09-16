package com.neueda.leap.auth;

import com.neueda.leap.user.User;
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
 * existence check. Sign-in is handled by the auth service, not here.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    /**
     * Creates the controller.
     *
     * @param authService registration and account lookup logic
     */
    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /**
     * Registers the business account for the caller identified by the bearer token.
     *
     * @param jwt     the verified access token
     * @param request the profile details from the registration form
     * @return the created account's id and email
     * @throws ForbiddenException if the request email differs from the token's email
     * @throws ConflictException  if the account already exists or the email is taken
     */
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public RegisterResponse register(@AuthenticationPrincipal Jwt jwt,
                                     @Valid @RequestBody RegisterRequest request) {
        User user = authService.register(AuthenticatedUser.from(jwt), request);
        return new RegisterResponse(user.getUserId(), user.getEmail());
    }

    /**
     * Reports whether a business account is registered with the email. Does not
     * require a token.
     *
     * @param request the email to check
     * @return whether an account exists
     */
    @PostMapping("/account-exists")
    public AccountExistsResponse accountExists(@Valid @RequestBody AccountExistsRequest request) {
        return new AccountExistsResponse(authService.accountExists(request.email()));
    }
}
