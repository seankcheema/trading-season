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
     * Records that the user accepted the platform terms in force, as Holdings
     * and Trade Service does when they accept in the dashboard. This service
     * only reads acceptances, so it has no repository method that can.
     *
     * @param jdbc   template bound to the test database
     * @param userId the user who accepted
     */
    public static void acceptCurrentTerms(JdbcTemplate jdbc, UUID userId) {
        acceptTerms(jdbc, userId, app.user.TermsAcceptance.CURRENT_VERSION);
    }

    /**
     * Records that the user accepted one version of the platform terms.
     *
     * @param jdbc         template bound to the test database
     * @param userId       the user who accepted
     * @param termsVersion the version they accepted
     */
    public static void acceptTerms(JdbcTemplate jdbc, UUID userId, String termsVersion) {
        jdbc.update("insert into terms_acceptances (user_id, terms_version, accepted_at) "
                + "values (?, ?, current_timestamp)", userId, termsVersion);
    }

    /**
     * Removes every account row and every terms acceptance.
     *
     * @param jdbc template bound to the test database
     */
    public static void deleteAll(JdbcTemplate jdbc) {
        jdbc.update("delete from terms_acceptances");
        jdbc.update("delete from user_accounts");
    }
}
