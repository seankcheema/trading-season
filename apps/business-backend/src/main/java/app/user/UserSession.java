package app.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Session entity representing an authenticated user's active login session.
 */
@Entity
@Table(name = "sessions")
public class UserSession {

    /** Creates an empty session entity for persistence. */
    public UserSession() {
    }

    @Id
    @Column(name = "session_id", updatable = false, nullable = false)
    private UUID sessionId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "issued_at", nullable = false)
    private OffsetDateTime issuedAt;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "revoked_at")
    private OffsetDateTime revokedAt;

    @Column(name = "last_seen_at", nullable = false)
    private OffsetDateTime lastSeenAt;

    /**
     * Returns the session identifier.
     *
     * @return the session identifier
     */
    public UUID getSessionId() {
        return sessionId;
    }

    /**
     * Sets the session identifier.
     *
     * @param sessionId the session identifier
     */
    public void setSessionId(UUID sessionId) {
        this.sessionId = sessionId;
    }

    /**
     * Returns the authenticated user identifier.
     *
     * @return the authenticated user identifier
     */
    public UUID getUserId() {
        return userId;
    }

    /**
     * Sets the authenticated user identifier.
     *
     * @param userId the authenticated user identifier
     */
    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    /**
     * Returns when the session was issued.
     *
     * @return when the session was issued
     */
    public OffsetDateTime getIssuedAt() {
        return issuedAt;
    }

    /**
     * Sets when the session was issued.
     *
     * @param issuedAt when the session was issued
     */
    public void setIssuedAt(OffsetDateTime issuedAt) {
        this.issuedAt = issuedAt;
    }

    /**
     * Returns when the session expires.
     *
     * @return when the session expires
     */
    public OffsetDateTime getExpiresAt() {
        return expiresAt;
    }

    /**
     * Sets when the session expires.
     *
     * @param expiresAt when the session expires
     */
    public void setExpiresAt(OffsetDateTime expiresAt) {
        this.expiresAt = expiresAt;
    }

    /**
     * Returns when the session was revoked, or {@code null} if active.
     *
     * @return when the session was revoked, or {@code null} if active
     */
    public OffsetDateTime getRevokedAt() {
        return revokedAt;
    }

    /**
     * Sets when the session was revoked, or {@code null} if active.
     *
     * @param revokedAt when the session was revoked, or {@code null} if active
     */
    public void setRevokedAt(OffsetDateTime revokedAt) {
        this.revokedAt = revokedAt;
    }

    /**
     * Returns when the session was last used.
     *
     * @return when the session was last used
     */
    public OffsetDateTime getLastSeenAt() {
        return lastSeenAt;
    }

    /**
     * Sets when the session was last used.
     *
     * @param lastSeenAt when the session was last used
     */
    public void setLastSeenAt(OffsetDateTime lastSeenAt) {
        this.lastSeenAt = lastSeenAt;
    }
}
