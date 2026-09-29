import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';
import { createHash } from 'crypto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PASSWORD_RESET_TOKEN_TTL_MINUTES,
  PASSWORD_RESET_TOKEN_TTL_MS,
  PasswordResetTokensService,
} from './password-reset-tokens.service.js';
import { PasswordResetToken } from './password-reset-token.entity.js';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

describe('PasswordResetTokensService', () => {
  let service: PasswordResetTokensService;
  let repository: any;

  beforeEach(async () => {
    repository = {
      create: vi.fn((row: Partial<PasswordResetToken>) => row),
      save: vi.fn(async (row: Partial<PasswordResetToken>) => ({ id: 'reset-1', ...row })),
      findOne: vi.fn(),
      update: vi.fn().mockResolvedValue({ affected: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetTokensService,
        { provide: getRepositoryToken(PasswordResetToken), useValue: repository },
      ],
    }).compile();

    service = module.get(PasswordResetTokensService);
  });

  describe('issue', () => {
    it('should return the raw token and store only its hash', async () => {
      const token = await service.issue('user-1');

      const stored = repository.save.mock.calls[0][0];
      expect(stored.tokenHash).toBe(sha256(token));
      // The raw value goes into an email and nowhere else. A leak of this table
      // must not hand over the ability to take over accounts.
      expect(JSON.stringify(stored)).not.toContain(token);
    });

    it('should issue an unguessable token', async () => {
      const first = await service.issue('user-1');
      const second = await service.issue('user-1');

      expect(first).not.toBe(second);
      // 32 random bytes, base64url: 43 characters with no padding.
      expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    it('should expire the token after the documented lifetime', async () => {
      const before = Date.now();
      await service.issue('user-1');

      const { expiresAt } = repository.save.mock.calls[0][0];
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + PASSWORD_RESET_TOKEN_TTL_MS);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(
        Date.now() + PASSWORD_RESET_TOKEN_TTL_MS,
      );
      expect(PASSWORD_RESET_TOKEN_TTL_MINUTES).toBe(30);
    });

    it('should revoke a link the user was already sent', async () => {
      // A second request is what someone does when the first email has not
      // arrived. Leaving both live would keep the older mailbox copy working.
      await service.issue('user-1');

      expect(repository.update).toHaveBeenCalledWith(
        { userId: 'user-1', usedAt: IsNull(), revokedAt: IsNull() },
        { revokedAt: expect.any(Date) },
      );
      expect(repository.update.mock.invocationCallOrder[0]).toBeLessThan(
        repository.save.mock.invocationCallOrder[0],
      );
    });
  });

  describe('findByToken', () => {
    it('should look the token up by its hash', async () => {
      repository.findOne.mockResolvedValue(null);

      await service.findByToken('some-token');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { tokenHash: sha256('some-token') },
      });
    });
  });

  describe('isUsable', () => {
    const usable = (): PasswordResetToken =>
      ({
        id: 'reset-1',
        userId: 'user-1',
        tokenHash: 'hash',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        revokedAt: null,
      }) as PasswordResetToken;

    it('should accept an unused, unrevoked, unexpired token', () => {
      expect(service.isUsable(usable())).toBe(true);
    });

    it('should reject a token that has already changed a password', () => {
      expect(service.isUsable({ ...usable(), usedAt: new Date() })).toBe(false);
    });

    it('should reject a revoked token', () => {
      expect(service.isUsable({ ...usable(), revokedAt: new Date() })).toBe(false);
    });

    it('should reject an expired token', () => {
      expect(
        service.isUsable({ ...usable(), expiresAt: new Date(Date.now() - 1) }),
      ).toBe(false);
    });
  });

  describe('markUsed', () => {
    it('should record when the link was spent rather than delete the row', async () => {
      const row = { id: 'reset-1', userId: 'user-1', usedAt: null } as PasswordResetToken;

      await service.markUsed(row);

      expect(row.usedAt).toBeInstanceOf(Date);
      expect(repository.save).toHaveBeenCalledWith(row);
    });
  });

  describe('revokeOutstandingForUser', () => {
    it('should revoke only the live links belonging to that user', async () => {
      await service.revokeOutstandingForUser('user-1');

      expect(repository.update).toHaveBeenCalledWith(
        { userId: 'user-1', usedAt: IsNull(), revokedAt: IsNull() },
        { revokedAt: expect.any(Date) },
      );
    });

    it('should not fail when there is nothing to revoke', async () => {
      repository.update.mockResolvedValue({ affected: 0 });

      await expect(service.revokeOutstandingForUser('user-1')).resolves.toBeUndefined();
    });
  });
});
