package com.neueda.leap.user;

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

    @Id
    @Column(name = "user_id", updatable = false, nullable = false)
    private UUID userId;

    @Column(name = "first_name", nullable = false)
    private String firstName;

    @Column(name = "middle_name")
    private String middleName;

    @Column(name = "last_name", nullable = false)
    private String lastName;

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

    @Column(name = "last_activity_at")
    private OffsetDateTime lastActivityAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getMiddleName() {
        return middleName;
    }

    public void setMiddleName(String middleName) {
        this.middleName = middleName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getSsn() {
        return ssn;
    }

    public void setSsn(String ssn) {
        this.ssn = ssn;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public void setDateOfBirth(LocalDate dateOfBirth) {
        this.dateOfBirth = dateOfBirth;
    }

    public String getTraderLevel() {
        return traderLevel;
    }

    public void setTraderLevel(String traderLevel) {
        this.traderLevel = traderLevel;
    }

    public BigDecimal getAvailableFunds() {
        return availableFunds;
    }

    public void setAvailableFunds(BigDecimal availableFunds) {
        this.availableFunds = availableFunds;
    }

    public String getUserRole() {
        return userRole;
    }

    public void setUserRole(String userRole) {
        this.userRole = userRole;
    }

    public String getAccountStatus() {
        return accountStatus;
    }

    public void setAccountStatus(String accountStatus) {
        this.accountStatus = accountStatus;
    }

    public Integer getSessionTimeoutMinutes() {
        return sessionTimeoutMinutes;
    }

    public void setSessionTimeoutMinutes(Integer sessionTimeoutMinutes) {
        this.sessionTimeoutMinutes = sessionTimeoutMinutes;
    }

    public BigDecimal getExecutionBufferPercent() {
        return executionBufferPercent;
    }

    public void setExecutionBufferPercent(BigDecimal executionBufferPercent) {
        this.executionBufferPercent = executionBufferPercent;
    }

    public OffsetDateTime getLastActivityAt() {
        return lastActivityAt;
    }

    public void setLastActivityAt(OffsetDateTime lastActivityAt) {
        this.lastActivityAt = lastActivityAt;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
