package app.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * User entity representing a user in the system.
 */
@Entity
@Table(name = "users")
public class User {

    /** Creates an empty user entity for persistence. */
    public User() {
    }

    @Id
    @Column(name = "user_id", updatable = false, nullable = false)
    private UUID userId;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(name = "first_name", nullable = false)
    private String firstName;

    @Column(name = "middle_name")
    private String middleName;

    @Column(name = "last_name", nullable = false)
    private String lastName;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String ssn;

    @Column(nullable = false)
    private String address;

    @Column(name = "date_of_birth", nullable = false)
    private LocalDate dateOfBirth;

    @Column(name = "trader_level", nullable = false)
    private String traderLevel = "BEGINNER";

    @Column(name = "available_funds", nullable = false)
    private BigDecimal availableFunds = BigDecimal.ZERO;

    @Column(name = "user_role", nullable = false)
    private String userRole = "TRADER";

    @Column(name = "account_status", nullable = false)
    private String accountStatus = "ACTIVE";

    @Column(name = "session_timeout_minutes", nullable = false)
    private Integer sessionTimeoutMinutes = 10;

    @Column(name = "execution_buffer_percent", nullable = false)
    private BigDecimal executionBufferPercent = BigDecimal.ZERO;

    @Column(name = "failed_login_attempts", nullable = false)
    private Integer failedLoginAttempts = 0;

    @Column(name = "locked_until")
    private OffsetDateTime lockedUntil;

    @Column(name = "last_login_at")
    private OffsetDateTime lastLoginAt;

    @Column(name = "last_activity_at")
    private OffsetDateTime lastActivityAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    /**
     * Returns the user identifier.
     *
     * @return the user identifier
     */
    public UUID getUserId() {
        return userId;
    }

    /**
     * Sets the user identifier.
     *
     * @param userId the user identifier
     */
    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    /**
     * Returns the login username.
     *
     * @return the login username
     */
    public String getUsername() {
        return username;
    }

    /**
     * Sets the login username.
     *
     * @param username the login username
     */
    public void setUsername(String username) {
        this.username = username;
    }

    /**
     * Returns the user's first name.
     *
     * @return the user's first name
     */
    public String getFirstName() {
        return firstName;
    }

    /**
     * Sets the user's first name.
     *
     * @param firstName the user's first name
     */
    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    /**
     * Returns the user's middle name, or {@code null}.
     *
     * @return the user's middle name, or {@code null}
     */
    public String getMiddleName() {
        return middleName;
    }

    /**
     * Sets the user's middle name, or {@code null}.
     *
     * @param middleName the user's middle name, or {@code null}
     */
    public void setMiddleName(String middleName) {
        this.middleName = middleName;
    }

    /**
     * Returns the user's last name.
     *
     * @return the user's last name
     */
    public String getLastName() {
        return lastName;
    }

    /**
     * Sets the user's last name.
     *
     * @param lastName the user's last name
     */
    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    /**
     * Returns the encoded password.
     *
     * @return the encoded password
     */
    public String getPasswordHash() {
        return passwordHash;
    }

    /**
     * Sets the encoded password.
     *
     * @param passwordHash the encoded password
     */
    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    /**
     * Returns the user's email address.
     *
     * @return the user's email address
     */
    public String getEmail() {
        return email;
    }

    /**
     * Sets the user's email address.
     *
     * @param email the user's email address
     */
    public void setEmail(String email) {
        this.email = email;
    }

    /**
     * Returns the user's Social Security number.
     *
     * @return the user's Social Security number
     */
    public String getSsn() {
        return ssn;
    }

    /**
     * Sets the user's Social Security number.
     *
     * @param ssn the user's Social Security number
     */
    public void setSsn(String ssn) {
        this.ssn = ssn;
    }

    /**
     * Returns the user's postal address.
     *
     * @return the user's postal address
     */
    public String getAddress() {
        return address;
    }

    /**
     * Sets the user's postal address.
     *
     * @param address the user's postal address
     */
    public void setAddress(String address) {
        this.address = address;
    }

    /**
     * Returns the user's date of birth.
     *
     * @return the user's date of birth
     */
    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    /**
     * Sets the user's date of birth.
     *
     * @param dateOfBirth the user's date of birth
     */
    public void setDateOfBirth(LocalDate dateOfBirth) {
        this.dateOfBirth = dateOfBirth;
    }

    /**
     * Returns the user's trader experience level.
     *
     * @return the user's trader experience level
     */
    public String getTraderLevel() {
        return traderLevel;
    }

    /**
     * Sets the user's trader experience level.
     *
     * @param traderLevel the user's trader experience level
     */
    public void setTraderLevel(String traderLevel) {
        this.traderLevel = traderLevel;
    }

    /**
     * Returns the funds available to the user.
     *
     * @return the funds available to the user
     */
    public BigDecimal getAvailableFunds() {
        return availableFunds;
    }

    /**
     * Sets the funds available to the user.
     *
     * @param availableFunds the funds available to the user
     */
    public void setAvailableFunds(BigDecimal availableFunds) {
        this.availableFunds = availableFunds;
    }

    /**
     * Returns the user's authorization role.
     *
     * @return the user's authorization role
     */
    public String getUserRole() {
        return userRole;
    }

    /**
     * Sets the user's authorization role.
     *
     * @param userRole the user's authorization role
     */
    public void setUserRole(String userRole) {
        this.userRole = userRole;
    }

    /**
     * Returns the account status.
     *
     * @return the account status
     */
    public String getAccountStatus() {
        return accountStatus;
    }

    /**
     * Sets the account status.
     *
     * @param accountStatus the account status
     */
    public void setAccountStatus(String accountStatus) {
        this.accountStatus = accountStatus;
    }

    /**
     * Returns the configured session timeout in minutes.
     *
     * @return the configured session timeout in minutes
     */
    public Integer getSessionTimeoutMinutes() {
        return sessionTimeoutMinutes;
    }

    /**
     * Sets the session timeout in minutes.
     *
     * @param sessionTimeoutMinutes the session timeout in minutes
     */
    public void setSessionTimeoutMinutes(Integer sessionTimeoutMinutes) {
        this.sessionTimeoutMinutes = sessionTimeoutMinutes;
    }

    /**
     * Returns the order execution buffer percentage.
     *
     * @return the order execution buffer percentage
     */
    public BigDecimal getExecutionBufferPercent() {
        return executionBufferPercent;
    }

    /**
     * Sets the order execution buffer percentage.
     *
     * @param executionBufferPercent the order execution buffer percentage
     */
    public void setExecutionBufferPercent(BigDecimal executionBufferPercent) {
        this.executionBufferPercent = executionBufferPercent;
    }

    /**
     * Returns the consecutive failed login count.
     *
     * @return the consecutive failed login count
     */
    public Integer getFailedLoginAttempts() {
        return failedLoginAttempts;
    }

    /**
     * Sets the consecutive failed login count.
     *
     * @param failedLoginAttempts the consecutive failed login count
     */
    public void setFailedLoginAttempts(Integer failedLoginAttempts) {
        this.failedLoginAttempts = failedLoginAttempts;
    }

    /**
     * Returns the account lock expiry, or {@code null} when unlocked.
     *
     * @return the account lock expiry, or {@code null} when unlocked
     */
    public OffsetDateTime getLockedUntil() {
        return lockedUntil;
    }

    /**
     * Sets the account lock expiry, or {@code null} to unlock.
     *
     * @param lockedUntil the account lock expiry, or {@code null} to unlock
     */
    public void setLockedUntil(OffsetDateTime lockedUntil) {
        this.lockedUntil = lockedUntil;
    }

    /**
     * Returns the most recent successful login time, or {@code null}.
     *
     * @return the most recent successful login time, or {@code null}
     */
    public OffsetDateTime getLastLoginAt() {
        return lastLoginAt;
    }

    /**
     * Sets the most recent successful login time.
     *
     * @param lastLoginAt the most recent successful login time
     */
    public void setLastLoginAt(OffsetDateTime lastLoginAt) {
        this.lastLoginAt = lastLoginAt;
    }

    /**
     * Returns the most recent account activity time, or {@code null}.
     *
     * @return the most recent account activity time, or {@code null}
     */
    public OffsetDateTime getLastActivityAt() {
        return lastActivityAt;
    }

    /**
     * Sets the most recent account activity time.
     *
     * @param lastActivityAt the most recent account activity time
     */
    public void setLastActivityAt(OffsetDateTime lastActivityAt) {
        this.lastActivityAt = lastActivityAt;
    }

    /**
     * Returns when the user account was created.
     *
     * @return when the user account was created
     */
    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    /**
     * Sets when the user account was created.
     *
     * @param createdAt when the user account was created
     */
    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
