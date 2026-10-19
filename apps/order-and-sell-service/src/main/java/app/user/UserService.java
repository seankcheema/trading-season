package app.user;

import org.springframework.stereotype.Service;

/**
 * Reads business accounts on behalf of their owners.
 */
@Service
public class UserService extends UserLookupService {

    /**
     * Creates the service.
     *
     * @param userRepository        persistence for business accounts
     * @param userAccountRepository read-only access to the auth service's
     *                              credential records
     */
    public UserService(UserRepository userRepository, UserAccountRepository userAccountRepository) {
        super(userRepository, userAccountRepository);
    }
}
