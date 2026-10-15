package app.user;

import app.auth.ConflictException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Reads business accounts on behalf of their owners, and records their
 * acceptance of the platform terms.
 */
@Service
public class UserService {

    /**
     * The version of the platform terms in force, named by its effective date.
     * Change it whenever the wording of the terms changes: every client then has
     * no acceptance for the new version and is asked to accept again.
     */
    public static final String CURRENT_TERMS_VERSION = "2026-10-12";

    @org.springframework.beans.factory.annotation.Autowired
    private app.account.AccountRepository accounts;
    private final UserRepository userRepository;
    private final UserAccountRepository userAccountRepository;
    private final TermsAcceptanceRepository termsAcceptanceRepository;

    /**
     * Creates the service.
     *
     * @param userRepository            persistence for business accounts
     * @param userAccountRepository     read-only access to the auth service's
     *                                  credential records
     * @param termsAcceptanceRepository persistence for accepted terms
     */
    public UserService(UserRepository userRepository, UserAccountRepository userAccountRepository,
                       TermsAcceptanceRepository termsAcceptanceRepository) {
        this.userRepository = userRepository;
        this.userAccountRepository = userAccountRepository;
        this.termsAcceptanceRepository = termsAcceptanceRepository;
    }

    /**
     * Loads the account belonging to the given user. Callers pass the id from the
     * verified token, never an id supplied in the request, so a client can only
     * read its own account.
     *
     * @param userId the caller's user id from the token's sub claim
     * @return the caller's account
     * @throws UserNotFoundException if the caller has not registered a business account
     */
    @Transactional(readOnly = true)
    public User getOwnAccount(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("Account is not registered"));
        user.setReservedCash(java.util.Objects.requireNonNullElse(accounts.reservedCash(userId), java.math.BigDecimal.ZERO));
        return user;
    }

    /**
     * Loads the credential record for the given user, so callers can report the
     * role and status as they stand rather than as the caller's token describes
     * them.
     *
     * @param userId the caller's user id from the token's sub claim
     * @return the credential record the auth service owns
     * @throws UserNotFoundException if no account exists for the id
     */
    @Transactional(readOnly = true)
    public UserAccount getUserAccount(UUID userId) {
        return userAccountRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("Account is not registered"));
    }

    /**
     * Reports whether the given user has accepted the terms currently in force.
     * An acceptance of an earlier version does not count.
     *
     * @param userId the caller's user id from the token's sub claim
     * @return {@code true} if the user accepted {@link #CURRENT_TERMS_VERSION}
     */
    @Transactional(readOnly = true)
    public boolean hasAcceptedCurrentTerms(UUID userId) {
        return termsAcceptanceRepository.existsById(new TermsAcceptanceId(userId, CURRENT_TERMS_VERSION));
    }

    /**
     * Records that the given user accepted the terms currently in force.
     *
     * <p>The caller names the version they were shown, so an acceptance is never
     * recorded against wording the user did not see. Accepting again changes
     * nothing: the first acceptance and its time stand.
     *
     * <p>The profile row is locked for the rest of the transaction, so two
     * requests from the same user cannot both find no acceptance and both
     * insert one.
     *
     * @param userId       the caller's user id from the token's sub claim
     * @param termsVersion the version of the terms the user was shown
     * @throws ConflictException     if {@code termsVersion} is not the version in force
     * @throws UserNotFoundException if the caller has not registered a business account
     */
    @Transactional
    public void acceptTerms(UUID userId, String termsVersion) {
        if (!CURRENT_TERMS_VERSION.equals(termsVersion)) {
            throw new ConflictException("The terms have changed. Reload to read the current version.");
        }
        userRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new UserNotFoundException("Account is not registered"));
        TermsAcceptanceId id = new TermsAcceptanceId(userId, termsVersion);
        if (!termsAcceptanceRepository.existsById(id)) {
            termsAcceptanceRepository.save(new TermsAcceptance(userId, termsVersion, OffsetDateTime.now()));
        }
    }
    /** Saves the authenticated owner's trading preference under the cash/profile lock.
     * @param userId verified owner
     * @param settings validated percentage
     * @return persisted preference
     * @throws UserNotFoundException if the profile does not exist */
    @Transactional
    public ExecutionSettings saveExecutionSettings(UUID userId, ExecutionSettings settings) {
        User user = userRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new UserNotFoundException("Account is not registered"));
        user.setExecutionBufferPercent(settings.executionBufferPercent());
        userRepository.save(user);
        return new ExecutionSettings(user.getExecutionBufferPercent());
    }
}
