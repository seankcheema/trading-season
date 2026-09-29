import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

/**
 * One password reset link issued to one email address.
 *
 * Mirrors the password_reset_tokens table created in
 * src/database/migrations/1790686840697-PasswordResetTokens.ts. Only the
 * SHA-256 hash of the token is stored — the raw value goes into the email and
 * is never persisted, so a database leak does not hand over the ability to take
 * over accounts.
 */
@Entity('password_reset_tokens')
export class PasswordResetToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_password_reset_tokens_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** SHA-256 hex of the opaque token. Unique, so lookup is a single index hit. */
  @Column({ name: 'token_hash', type: 'text', unique: true })
  tokenHash: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Index('idx_password_reset_tokens_expires_at')
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  /** Set once this link changed a password. A token is single-use. */
  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  /** Set when the link will never be usable: superseded by a newer request, or the password changed by another route. */
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;
}
