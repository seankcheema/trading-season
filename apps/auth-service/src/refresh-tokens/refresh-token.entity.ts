import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

/**
 * A refresh token issued to one signed-in session.
 *
 * Mirrors the refresh_tokens table created in the initial migration. Only the
 * SHA-256 hash of the token is stored — the raw value is returned to the client
 * once and never persisted, so a database leak does not hand over live sessions.
 */
@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_refresh_tokens_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** SHA-256 hex of the opaque token. Unique, so lookup is a single index hit. */
  @Column({ name: 'token_hash', type: 'text', unique: true })
  tokenHash: string;

  @Column({ name: 'issued_at', type: 'timestamptz', default: () => 'now()' })
  issuedAt: Date;

  @Index('idx_refresh_tokens_expires_at')
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  /** Set on logout, on rotation, and when a replay is detected. */
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  /** The token that superseded this one, when it was rotated. */
  @Column({ name: 'replaced_by', type: 'uuid', nullable: true })
  replacedBy: string | null;
}
