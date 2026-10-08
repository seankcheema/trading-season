package app.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Immutable;

import java.util.UUID;

/**
 * A read-only view of the credential record the auth service owns.
 *
 * <p>Authentication state lives in {@code user_accounts}, written only by the
 * NestJS auth service. This service reads it because {@code email} and
 * {@code userRole} are reported on the caller's profile, where they should
 * reflect the account as it stands at the moment it is read rather than as of
 * whenever the caller's token was signed.
 *
 * <p>Marked {@link Immutable} so Hibernate silently discards any attempt to
 * update it: the auth service is the only writer, and that is enforced here
 * rather than left to convention.
 *
 * <p>{@code password_hash}, {@code failed_login_attempts} and
 * {@code locked_until} are deliberately not mapped. This service has no use for
 * them, and an unmapped column cannot be read by accident or logged.
 */
@Entity
@Immutable
@Table(name = "user_accounts")
public class UserAccount {

    /** The auth service's user UUID, carried as the access token's sub claim. */
    @Id
    @Column(name = "user_id", updatable = false, nullable = false)
    private UUID userId;

    @Column(name = "email", nullable = false)
    private String email;

    /** ADMIN, TRADER or ANALYST. */
    @Column(name = "user_role", nullable = false)
    private String userRole;

    /**
     * Required by Hibernate.
     */
    protected UserAccount() {
    }

    /**
     * Creates a record directly, for tests that stand in for the auth service.
     *
     * <p>There is no repository method that writes this table, so constructing
     * one here cannot persist it through this service.
     *
     * @param userId   the account id
     * @param email    the login email
     * @param userRole ADMIN, TRADER or ANALYST
     */
    public UserAccount(UUID userId, String email, String userRole) {
        this.userId = userId;
        this.email = email;
        this.userRole = userRole;
    }

    /**
     * Returns the account id.
     *
     * @return the user UUID
     */
    public UUID getUserId() {
        return userId;
    }

    /**
     * Returns the login email address.
     *
     * @return the email
     */
    public String getEmail() {
        return email;
    }

    /**
     * Returns the account role.
     *
     * @return ADMIN, TRADER or ANALYST
     */
    public String getUserRole() {
        return userRole;
    }
}
