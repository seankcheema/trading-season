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

    /**
     * Creates the service.
     *
     * @param userRepository persistence for business accounts
     */
    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
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
}
