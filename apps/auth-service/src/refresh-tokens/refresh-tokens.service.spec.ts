import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHash } from 'crypto';
import { RefreshTokensService } from './refresh-tokens.service.js';
import { RefreshToken } from './refresh-token.entity.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

describe('RefreshTokensService', () => {
  let service: RefreshTokensService;
  let repository: any;

  beforeEach(async () => {
    repository = {
      create: vi.fn((row: any) => row),
      save: vi.fn(async (row: any) => ({ id: 'generated-id', ...row })),
      findOne: vi.fn(),
      update: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokensService,
        { provide: getRepositoryToken(RefreshToken), useValue: repository },
      ],
    }).compile();

    service = module.get<RefreshTokensService>(RefreshTokensService);
  });

  describe('issue', () => {
    it('should return an opaque token and store only its SHA-256 hash', async () => {
      const token = await service.issue('user-1');

      // The raw token must never reach the database — a dump of the table
      // should not hand over live sessions.
      const saved = repository.save.mock.calls[0][0];
      expect(saved.tokenHash).toBe(
        createHash('sha256').update(token).digest('hex'),
      );
      expect(saved.tokenHash).not.toBe(token);
      expect(saved.userId).toBe('user-1');
    });

    it('should issue a token with at least 256 bits of entropy', async () => {
      const token = await service.issue('user-1');

      // 32 random bytes, base64url encoded, is 43 characters.
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    it('should never issue the same token twice', async () => {
      const first = await service.issue('user-1');
      const second = await service.issue('user-1');

      expect(first).not.toBe(second);
    });

    it('should set expiry 7 days out', async () => {
      const before = Date.now();
      await service.issue('user-1');
      const after = Date.now();

      const saved = repository.save.mock.calls[0][0];
      const expiry = saved.expiresAt.getTime();

      expect(expiry).toBeGreaterThanOrEqual(before + SEVEN_DAYS_MS);
      expect(expiry).toBeLessThanOrEqual(after + SEVEN_DAYS_MS);
    });
  });

  describe('isUsable', () => {
    it('should accept a live token', () => {
      expect(
        service.isUsable({
          revokedAt: null,
          expiresAt: new Date(Date.now() + 1000),
        } as RefreshToken),
      ).toBe(true);
    });

    it('should reject a revoked token', () => {
      expect(
        service.isUsable({
          revokedAt: new Date(),
          expiresAt: new Date(Date.now() + 1000),
        } as RefreshToken),
      ).toBe(false);
    });

    it('should reject an expired token', () => {
      expect(
        service.isUsable({
          revokedAt: null,
          expiresAt: new Date(Date.now() - 1000),
        } as RefreshToken),
      ).toBe(false);
    });
  });

  describe('rotate', () => {
    it('should issue a new token and revoke the old one, linked by replaced_by', async () => {
      const current = {
        id: 'old-row',
        userId: 'user-1',
        revokedAt: null,
        replacedBy: null,
      } as unknown as RefreshToken;

      const next = await service.rotate(current);

      expect(next).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(current.revokedAt).toBeInstanceOf(Date);
      expect(current.replacedBy).toBe('generated-id');
    });
  });

  describe('revoke', () => {
    it('should stamp revoked_at', async () => {
      const row = { revokedAt: null } as RefreshToken;

      await service.revoke(row);

      expect(row.revokedAt).toBeInstanceOf(Date);
      expect(repository.save).toHaveBeenCalledWith(row);
    });

    it('should leave an already-revoked token untouched', async () => {
      const revokedAt = new Date('2020-01-01');
      const row = { revokedAt } as RefreshToken;

      await service.revoke(row);

      expect(row.revokedAt).toBe(revokedAt);
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('revokeAllForUser', () => {
    it('should revoke only the live tokens for that user', async () => {
      await service.revokeAllForUser('user-1');

      const [criteria, patch] = repository.update.mock.calls[0];
      expect(criteria.userId).toBe('user-1');
      expect(patch.revokedAt).toBeInstanceOf(Date);
    });
  });
});
