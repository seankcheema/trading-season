package app.support;

import org.springframework.jdbc.core.JdbcTemplate;

import java.util.UUID;

/**
 * Stands in for the auth service in tests.
 *
 * <p>Integration tests mint their own access tokens, which means no account row
 * exists for the subject they invent. In production the auth service creates
 * that row before it ever issues a token, so a test that skips it is exercising
 * a state the system cannot reach. These helpers write the row directly,
 * because this service deliberately has no repository method that can.
 */
public final class UserAccountFixture {

    private UserAccountFixture() {
    }

    /**
     * Creates the account row the auth service would have created at sign-up.
     *
     * @param jdbc   template bound to the test database
     * @param userId the id used as the token subject
     * @param email  the account email, matching the token's email claim
     */
    public static void createActiveAccount(JdbcTemplate jdbc, UUID userId, String email) {
        jdbc.update("insert into user_accounts (user_id, email, user_role) "
                + "values (?, ?, 'TRADER')", userId, email);
    }

    /**
     * Removes every account row.
     *
     * @param jdbc template bound to the test database
     */
    public static void deleteAll(JdbcTemplate jdbc) {
        jdbc.update("delete from user_accounts");
    }
}
