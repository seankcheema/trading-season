import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { PasswordResetToken } from './password-reset-token.entity.js';

/** Thirty minutes, in milliseconds. */
export const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

/** The same lifetime in whole minutes, for the wording of the email. */
export const PASSWORD_RESET_TOKEN_TTL_MINUTES = PASSWORD_RESET_TOKEN_TTL_MS / 60_000;

@Injectable()
export class PasswordResetTokensService {
  private readonly logger = new Logger(PasswordResetTokensService.name);

  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly repository: Repository<PasswordResetToken>,
  ) {}

  /**
   * Hash a reset token for storage.
   *
   * SHA-256, not bcrypt, for the reason given in RefreshTokensService.hash: a
   * 256-bit random value is not guessable, so a slow KDF buys nothing and costs
   * the indexed lookup.
   */
  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Issue a reset token for a user and store its hash.
   *
   * Any link the user was already sent is revoked first. Requesting a second
   * email is the normal reaction to one that has not arrived, and leaving both
   * live would mean the older mailbox copy keeps working for its full lifetime.
   */
  async issue(userId: string): Promise<string> {
    await this.revokeOutstandingForUser(userId);

    const token = randomBytes(32).toString('base64url');

    await this.repository.save(
      this.repository.create({
        userId,
        tokenHash: this.hash(token),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
        usedAt: null,
        revokedAt: null,
      }),
    );

    return token;
  }

  /** Find a token row by its raw value, whether or not it is still usable. */
  async findByToken(token: string): Promise<PasswordResetToken | null> {
    return this.repository.findOne({ where: { tokenHash: this.hash(token) } });
  }

  /** True when the row is unused, unrevoked and not past its expiry. */
  isUsable(row: PasswordResetToken): boolean {
    return row.usedAt === null && row.revokedAt === null && row.expiresAt > new Date();
  }

  /**
   * Mark the token that changed a password as spent.
   *
   * Recorded on the row rather than deleted, so a later question about which
   * link was used, and when, has an answer.
   */
  async markUsed(row: PasswordResetToken): Promise<void> {
    row.usedAt = new Date();
    await this.repository.save(row);
  }

  /**
   * Revoke every live link for a user.
   *
   * Called when a new one is issued and again once a password has been changed,
   * so a mailbox full of older links is worthless.
   */
  async revokeOutstandingForUser(userId: string): Promise<void> {
    const { affected } = await this.repository.update(
      { userId, usedAt: IsNull(), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );

    if (affected) {
      this.logger.debug(`Revoked ${affected} outstanding reset token(s) for user ${userId}`);
    }
  }
}
