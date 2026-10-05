package app.user;

import app.auth.AuthenticatedUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * REST endpoints for the authenticated caller's own account. The account is
 * always resolved from the bearer token, so no path or body parameter can name
 * another user.
 */
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    /**
     * Creates the controller.
     *
     * @param userService account lookup logic
     */
    public UserController(UserService userService) {
        this.userService = userService;
    }

    /**
     * Returns the caller's business account.
     *
     * @param jwt the verified access token
     * @return the caller's profile, without the SSN
     * @throws UserNotFoundException if the caller has not registered
     */
    @GetMapping("/me")
    public UserProfileResponse me(@AuthenticationPrincipal Jwt jwt) {
        UUID userId = AuthenticatedUser.from(jwt).userId();
        return UserProfileResponse.from(userService.getOwnAccount(userId),
                userService.getUserAccount(userId));
    }

    /**
     * Records that the caller accepted the platform terms and conditions.
     *
     * @param jwt the verified access token
     * @return the caller's updated profile, without the SSN
     * @throws UserNotFoundException if the caller has not registered
     */
    @PutMapping("/me/terms-acceptance")
    public UserProfileResponse acceptTerms(@AuthenticationPrincipal Jwt jwt) {
        UUID userId = AuthenticatedUser.from(jwt).userId();
        return UserProfileResponse.from(userService.acceptTerms(userId),
                userService.getUserAccount(userId));
    }
}
