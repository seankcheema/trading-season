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
public class UserService extends UserLookupService {

    /**
     * The version of the platform terms in force, named by its effective date.
     * Change it whenever the wording of the terms changes: every client then has
     * no acceptance for the new version and is asked to accept again.
     */
    public static final String CURRENT_TERMS_VERSION = "2026-10-12";

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
        super(userRepository, userAccountRepository);
        this.termsAcceptanceRepository = termsAcceptanceRepository;
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
}
