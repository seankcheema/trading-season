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
 * A trader or admin's business account: profile, funds and account settings.
 *
 * <p>The primary key is the auth service's user UUID, carried as the access
 * token's {@code sub} claim. Credentials, lockout and login history live only in
 * the auth service.
 */
@Entity
@Table(name = "users")
public class User {

    /** Creates an instance of this class. */
    public User() {
    }

    @Id
    @Column(name = "user_id", updatable = false, nullable = false)
    private UUID userId;

    @Column(name = "first_name", nullable = false)
    private String firstName;

    @Column(name = "middle_name")
    private String middleName;

    @Column(name = "last_name", nullable = false)
    private String lastName;


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



    @Column(name = "session_timeout_minutes", nullable = false)
    private Integer sessionTimeoutMinutes = 10;

    @Column(name = "execution_buffer_percent", nullable = false)
    private BigDecimal executionBufferPercent = BigDecimal.ZERO;

    @Column(name = "last_activity_at")
    private OffsetDateTime lastActivityAt;

    @Column(name = "terms_accepted_at")
    private OffsetDateTime termsAcceptedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    /**
     * Returns the user ID.
     *
     * @return the user ID
     */
    public UUID getUserId() {
        return userId;
    }

    /**
     * Sets the user ID.
     *
     * @param userId the user ID
     */
    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    /**
     * Returns the first name.
     *
     * @return the first name
     */
    public String getFirstName() {
        return firstName;
    }

    /**
     * Sets the first name.
     *
     * @param firstName the first name
     */
    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    /**
     * Returns the middle name.
     *
     * @return the middle name
     */
    public String getMiddleName() {
        return middleName;
    }

    /**
     * Sets the middle name.
     *
     * @param middleName the middle name
     */
    public void setMiddleName(String middleName) {
        this.middleName = middleName;
    }

    /**
     * Returns the last name.
     *
     * @return the last name
     */
    public String getLastName() {
        return lastName;
    }

    /**
     * Sets the last name.
     *
     * @param lastName the last name
     */
    public void setLastName(String lastName) {
        this.lastName = lastName;
    }


    /**
     * Returns the SSN.
     *
     * @return the SSN
     */
    public String getSsn() {
        return ssn;
    }

    /**
     * Sets the SSN.
     *
     * @param ssn the SSN
     */
    public void setSsn(String ssn) {
        this.ssn = ssn;
    }

    /**
     * Returns the address.
     *
     * @return the address
     */
    public String getAddress() {
        return address;
    }

    /**
     * Sets the address.
     *
     * @param address the address
     */
    public void setAddress(String address) {
        this.address = address;
    }

    /**
     * Returns the date of birth.
     *
     * @return the date of birth
     */
    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    /**
     * Sets the date of birth.
     *
     * @param dateOfBirth the date of birth
     */
    public void setDateOfBirth(LocalDate dateOfBirth) {
        this.dateOfBirth = dateOfBirth;
    }

    /**
     * Returns the trader level.
     *
     * @return the trader level
     */
    public String getTraderLevel() {
        return traderLevel;
    }

    /**
     * Sets the trader level.
     *
     * @param traderLevel the trader level
     */
    public void setTraderLevel(String traderLevel) {
        this.traderLevel = traderLevel;
    }

    /**
     * Returns the available funds.
     *
     * @return the available funds
     */
    public BigDecimal getAvailableFunds() {
        return availableFunds;
    }

    /**
     * Sets the available funds.
     *
     * @param availableFunds the available funds
     */
    public void setAvailableFunds(BigDecimal availableFunds) {
        this.availableFunds = availableFunds;
    }



    /**
     * Returns the session timeout minutes.
     *
     * @return the session timeout minutes
     */
    public Integer getSessionTimeoutMinutes() {
        return sessionTimeoutMinutes;
    }

    /**
     * Sets the session timeout minutes.
     *
     * @param sessionTimeoutMinutes the session timeout minutes
     */
    public void setSessionTimeoutMinutes(Integer sessionTimeoutMinutes) {
        this.sessionTimeoutMinutes = sessionTimeoutMinutes;
    }

    /**
     * Returns the execution buffer percent.
     *
     * @return the execution buffer percent
     */
    public BigDecimal getExecutionBufferPercent() {
        return executionBufferPercent;
    }

    /**
     * Sets the execution buffer percent.
     *
     * @param executionBufferPercent the execution buffer percent
     */
    public void setExecutionBufferPercent(BigDecimal executionBufferPercent) {
        this.executionBufferPercent = executionBufferPercent;
    }

    /**
     * Returns the last activity at.
     *
     * @return the last activity at
     */
    public OffsetDateTime getLastActivityAt() {
        return lastActivityAt;
    }

    /**
     * Sets the last activity at.
     *
     * @param lastActivityAt the last activity at
     */
    public void setLastActivityAt(OffsetDateTime lastActivityAt) {
        this.lastActivityAt = lastActivityAt;
    }

    public OffsetDateTime getTermsAcceptedAt() {
        return termsAcceptedAt;
    }

    public void setTermsAcceptedAt(OffsetDateTime termsAcceptedAt) {
        this.termsAcceptedAt = termsAcceptedAt;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    /**
     * Sets the created at.
     *
     * @param createdAt the created at
     */
    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}


