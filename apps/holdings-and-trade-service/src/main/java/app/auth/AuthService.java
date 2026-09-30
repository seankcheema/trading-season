package app.auth;

import app.account.AccountService;
import app.user.User;
import app.user.UserAccountRepository;
import app.user.UserRepository;
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
    private final AccountService accountService;
    private final UserAccountRepository userAccountRepository;

    /**
     * Creates the service.
     *
     * @param userRepository         persistence for business accounts
     * @param accountService  service for managing user accounts
     * @param userAccountRepository read-only access to the credential records
     *                              the auth service owns
     */
    public AuthService(UserRepository userRepository, AccountService accountService, UserAccountRepository userAccountRepository) {
        this.userRepository = userRepository;
        this.accountService = accountService;
        this.userAccountRepository = userAccountRepository;
    }

    /**
     * Creates the business account for the authenticated caller from the
     * registration form's profile details. Also creates a default "Main Account"
     * for the new user.
     *
     * @param caller  the user identified by the verified access token
     * @param request the profile details
     * @return the newly created user, whose id equals the caller's token subject
     * @throws ForbiddenException if the request email differs from the token's email claim
     * @throws ConflictException  if the caller already has an account
     */
    @Transactional
    public User register(AuthenticatedUser caller, RegisterRequest request) {
        if (caller.email() == null || !caller.email().equalsIgnoreCase(request.email())) {
            throw new ForbiddenException("Email does not match the signed-in account");
        }
        if (userRepository.existsById(caller.userId())) {
            throw new ConflictException("Account is already registered");
        }

        User user = new User();
        user.setUserId(caller.userId());
        user.setFirstName(request.firstName());
        user.setMiddleName(request.middleName());
        user.setLastName(request.lastName());
        user.setSsn(request.ssn());
        user.setAddress(request.address());
        user.setDateOfBirth(request.dateOfBirth());
        user.setTraderLevel(request.traderLevel());
        user.setAvailableFunds(request.availableFunds());
        user.setCreatedAt(OffsetDateTime.now());
        userRepository.save(user);

        // Create a default "Main Account" for the new user
        accountService.createDefaultAccountForUser(caller.userId());

        return user;
    }

    /**
     * Soft check for whether a business account uses the email, ignoring case.
     *
     * <p>Reads user_accounts, which the auth service owns: an address is taken
     * from the moment credentials exist, whether or not a profile has been
     * filled in yet. The profile row no longer stores an email to check.
     *
     * <p>This is a convenience for the registration form, not an authorization
     * decision, and it is unauthenticated. Because it reveals whether an email
     * is registered, callers should rate-limit it at the edge.
     *
     * @param email the email to look up
     * @return {@code true} if an account is registered with the email
     */
    @Transactional(readOnly = true)
    public boolean accountExists(String email) {
        return userAccountRepository.existsByEmailIgnoreCase(email.trim());
    }
}


