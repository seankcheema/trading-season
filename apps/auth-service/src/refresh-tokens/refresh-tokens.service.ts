import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { RefreshToken } from './refresh-token.entity.js';

/** Seven days, in milliseconds. */
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class RefreshTokensService {
  private readonly logger = new Logger(RefreshTokensService.name);

  constructor(
    @InjectRepository(RefreshToken)
    private readonly repository: Repository<RefreshToken>,
  ) {}

  /**
   * Hash a refresh token for storage.
   *
   * SHA-256, not bcrypt. Passwords need a slow KDF because they are
   * low-entropy and guessable; a 256-bit random token is not, so the cost buys
   * nothing — and it would cost the indexed lookup, forcing a scan of every
   * row for the user.
   */
  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Issue a new opaque refresh token and store its hash. */
  async issue(userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');

    await this.repository.save(
      this.repository.create({
        userId,
        tokenHash: this.hash(token),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        revokedAt: null,
        replacedBy: null,
      }),
    );

    return token;
  }

  /** Find a token row by its raw value, whether or not it is still valid. */
  async findByToken(token: string): Promise<RefreshToken | null> {
    return this.repository.findOne({ where: { tokenHash: this.hash(token) } });
  }

  /** True when the row is neither revoked nor past its expiry. */
  isUsable(row: RefreshToken): boolean {
    return row.revokedAt === null && row.expiresAt > new Date();
  }

  /**
   * Exchange a valid token for a fresh one, revoking the old row and recording
   * which token replaced it.
   */
  async rotate(current: RefreshToken): Promise<string> {
    const next = randomBytes(32).toString('base64url');

    const created = await this.repository.save(
      this.repository.create({
        userId: current.userId,
        tokenHash: this.hash(next),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        revokedAt: null,
        replacedBy: null,
      }),
    );

    current.revokedAt = new Date();
    current.replacedBy = created.id;
    await this.repository.save(current);

    return next;
  }

  /** Revoke one token. Used by logout. */
  async revoke(row: RefreshToken): Promise<void> {
    if (row.revokedAt === null) {
      row.revokedAt = new Date();
      await this.repository.save(row);
    }
  }

  /**
   * Revoke every live token for a user.
   *
   * Called when an already-rotated token is presented again, which means the
   * token leaked: the legitimate holder and an attacker both have it. Ending
   * every session turns that from indefinite access into one failed request.
   */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.repository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    this.logger.warn(`Revoked all refresh tokens for user ${userId}`);
  }
}
