package app.auth;

import app.user.SessionRepository;
import app.user.User;
import app.user.UserRepository;
import app.user.UserSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

/**
 * Creates business accounts for users already signed up with the auth service,
 * and answers whether an email is already registered.
 *
 * <p>This service never handles passwords, logins or sessions; those belong to
 * the auth service. A business account is keyed by the auth service's user UUID
 * taken from the verified token.
 */
@Service
public class AuthService {

    private final UserRepository userRepository;

    /**
     * Creates the service.
     *
     * @param userRepository persistence for business accounts
     */
    public AuthService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Creates the business account for the authenticated caller from the
     * registration form's profile details.
     *
     * @param caller  the user identified by the verified access token
     * @param request the profile details
     * @return the newly created user, whose id equals the caller's token subject
     * @throws ForbiddenException if the request email differs from the token's email claim
     * @throws ConflictException  if the caller already has an account, or the email is
     *                            registered to another account
     */
    @Transactional
    public User register(AuthenticatedUser caller, RegisterRequest request) {
        if (caller.email() == null || !caller.email().equalsIgnoreCase(request.email())) {
            throw new ForbiddenException("Email does not match the signed-in account");
        }
        if (userRepository.existsById(caller.userId())) {
            throw new ConflictException("Account is already registered");
        }
        if (userRepository.existsByEmailIgnoreCase(request.email())) {
            throw new ConflictException("Email is already registered");
        }

        User user = new User();
        user.setUserId(caller.userId());
        user.setEmail(request.email());
        user.setFirstName(request.firstName());
        user.setMiddleName(request.middleName());
        user.setLastName(request.lastName());
        user.setSsn(request.ssn());
        user.setAddress(request.address());
        user.setDateOfBirth(request.dateOfBirth());
        user.setTraderLevel(request.traderLevel());
        user.setAvailableFunds(request.availableFunds());
        user.setCreatedAt(OffsetDateTime.now());
        return userRepository.save(user);
    }

    /**
     * Soft check for whether a business account uses the email, ignoring case.
     *
     * <p>This is a convenience for the registration form, not an authorization
     * decision: it is unauthenticated, and {@link #register} still enforces
     * uniqueness. Because it reveals whether an email is registered, callers
     * should rate-limit it at the edge.
     *
     * @param email the email to look up
     * @return {@code true} if an account is registered with the email
     */
    @Transactional(readOnly = true)
    public boolean accountExists(String email) {
        return userRepository.existsByEmailIgnoreCase(email.trim());
    }
}


