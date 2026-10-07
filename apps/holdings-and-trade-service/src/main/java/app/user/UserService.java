package app.user;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Reads business accounts on behalf of their owners.
 */
@Service
public class UserService {

    private final UserRepository userRepository;
    private final UserAccountRepository userAccountRepository;

    /**
     * Creates the service.
     *
     * @param userRepository        persistence for business accounts
     * @param userAccountRepository read-only access to the auth service's
     *                              credential records
     */
    public UserService(UserRepository userRepository, UserAccountRepository userAccountRepository) {
        this.userRepository = userRepository;
        this.userAccountRepository = userAccountRepository;
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
        return userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("Account is not registered"));
    }

    /** Saves the owner's execution buffer under the shared user row lock.
     * @param userId verified caller
     * @param settings validated execution settings
     * @return saved settings
     * @throws UserNotFoundException if the business profile is missing */
    @Transactional
    public ExecutionSettings saveExecutionSettings(UUID userId, ExecutionSettings settings) {
        User user = userRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new UserNotFoundException("Account is not registered"));
        user.setExecutionBufferPercent(settings.executionBufferPercent());
        userRepository.save(user);
        return new ExecutionSettings(user.getExecutionBufferPercent());
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
}
