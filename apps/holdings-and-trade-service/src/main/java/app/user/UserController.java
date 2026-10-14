package app.user;

import app.auth.AuthenticatedUser;
import jakarta.validation.Valid;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * REST endpoints for the authenticated caller's own account. The account is
 * always resolved from the bearer token, so no path or body parameter can name
 * another user.
 */
@RestController
@RequestMapping("/api/users/me")
@Tag(name = "Users", description = "User profile information endpoints")
public class UserController {

    private final UserService userService;

    /**
     * Creates the controller.
     *
     * @param userService account lookup and terms acceptance logic
     */
    public UserController(UserService userService) {
        this.userService = userService;
    }

    /** Returns the owner's execution protection.
     * @param jwt verified token
     * @return saved percentage */
    @GetMapping("/execution-settings")
    @Operation(summary = "Get execution buffer")
    public ExecutionSettings executionSettings(@AuthenticationPrincipal Jwt jwt) {
        return new ExecutionSettings(userService.getOwnAccount(AuthenticatedUser.from(jwt).userId()).getExecutionBufferPercent());
    }

    /** Updates the owner's execution protection.
     * @param settings percentage from zero to ten, with two decimals
     * @param jwt verified token
     * @return saved percentage */
    @PutMapping("/execution-settings")
    @Operation(summary = "Save execution buffer", description = "Saves a user-wide adverse price tolerance from 0 to 10 percent")
    public ExecutionSettings saveExecutionSettings(@Valid @RequestBody ExecutionSettings settings,
            @AuthenticationPrincipal Jwt jwt) {
        return userService.saveExecutionSettings(AuthenticatedUser.from(jwt).userId(), settings);
    }

    /**
     * Returns the caller's business account.
     *
     * @param jwt the verified access token
     * @return the caller's profile, without the SSN
     * @throws UserNotFoundException if the caller has not registered
     */
    @GetMapping
    @Operation(summary = "Get authenticated user profile", description = "Returns the profile of the authenticated user, including personal and account information")
    public UserProfileResponse me(@AuthenticationPrincipal Jwt jwt) {
        return profileOf(AuthenticatedUser.from(jwt).userId());
    }

    /**
     * Records that the caller accepts the platform terms. Accepting again
     * succeeds and changes nothing.
     *
     * @param jwt     the verified access token
     * @param request the version of the terms the caller was shown
     * @return the caller's profile, now reporting the terms as accepted
     * @throws app.auth.ConflictException if the version shown is not the one in force
     * @throws UserNotFoundException      if the caller has not registered
     */
    @PutMapping("/terms-acceptance")
    @Operation(summary = "Accept the platform terms", description = "Records that the authenticated user accepts the version of the platform terms they were shown, and returns their updated profile")
    public UserProfileResponse acceptTerms(@AuthenticationPrincipal Jwt jwt,
                                           @Valid @RequestBody AcceptTermsRequest request) {
        UUID userId = AuthenticatedUser.from(jwt).userId();
        userService.acceptTerms(userId, request.termsVersion());
        return profileOf(userId);
    }

    private UserProfileResponse profileOf(UUID userId) {
        return UserProfileResponse.from(userService.getOwnAccount(userId),
                userService.getUserAccount(userId), userService.hasAcceptedCurrentTerms(userId));
    }
}
