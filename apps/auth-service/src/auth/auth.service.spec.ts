import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { RefreshTokensService } from '../refresh-tokens/refresh-tokens.service.js';

describe('AuthService', () => {
  let service: AuthService;
  let mockUsersService: any;
  let mockJwtService: any;
  let mockRefreshTokens: any;

  beforeEach(async () => {
    mockUsersService = {
      create: vi.fn(),
      findByEmail: vi.fn(),
      findById: vi.fn(),
      validatePassword: vi.fn(),
      incrementFailedAttempts: vi.fn(),
      lockAccount: vi.fn(),
      resetFailedAttempts: vi.fn(),
      isAccountLocked: vi.fn(),
    };

    mockJwtService = {
      sign: vi.fn(),
      verify: vi.fn(),
    };

    // Refresh tokens are opaque strings held in the database, so the service
    // hands issuing and revocation to RefreshTokensService rather than signing
    // a second JWT. Defaults here cover the happy path; individual tests
    // override them.
    mockRefreshTokens = {
      issue: vi.fn().mockResolvedValue('opaque-refresh-token'),
      findByToken: vi.fn(),
      isUsable: vi.fn().mockReturnValue(true),
      rotate: vi.fn().mockResolvedValue('rotated-refresh-token'),
      revoke: vi.fn().mockResolvedValue(undefined),
      revokeAllForUser: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: RefreshTokensService,
          useValue: mockRefreshTokens,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should register a new user and return tokens', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockUser = {
        id: '123',
        email: registerDto.email,
        role: 'TRADER',
      };

      mockUsersService.create.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('token');

      const result = await service.register(
        registerDto.email,
        registerDto.password,
      );

      expect(result.accessToken).toBe('token');
      expect(result.refreshToken).toBe('opaque-refresh-token');
      expect(mockRefreshTokens.issue).toHaveBeenCalledWith('123');
      expect(result.expiresIn).toBe(900); // 15 minutes
    });

    it('should reject password shorter than 8 characters', async () => {
      await expect(
        service.register('test@example.com', 'short'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject a missing email', async () => {
      await expect(service.register('', 'password123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject a missing password', async () => {
      await expect(service.register('test@example.com', '')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('login', () => {
    it('should return tokens on successful login', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        password: 'hashedpassword',
        isActive: true,
        failedAttempts: 0,
        lockedUntil: null,
      };

      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockUsersService.isAccountLocked.mockReturnValue(false);
      mockUsersService.validatePassword.mockResolvedValue(true);
      mockUsersService.resetFailedAttempts.mockResolvedValue(undefined);
      mockJwtService.sign.mockReturnValue('token');

      const result = await service.login('test@example.com', 'password123');

      expect(result.accessToken).toBe('token');
      expect(result.refreshToken).toBe('opaque-refresh-token');
      expect(mockUsersService.resetFailedAttempts).toHaveBeenCalledWith('123');
    });

    it('should return 401 on bad credentials', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login('nonexistent@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateUser', () => {
    it('should return user on valid credentials', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        password: 'hashedpassword',
        isActive: true,
        failedAttempts: 0,
        lockedUntil: null,
      };

      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockUsersService.isAccountLocked.mockReturnValue(false);
      mockUsersService.validatePassword.mockResolvedValue(true);
      mockUsersService.resetFailedAttempts.mockResolvedValue(undefined);

      const result = await service.validateUser('test@example.com', 'password123');

      expect(result).toEqual(mockUser);
      expect(mockUsersService.resetFailedAttempts).toHaveBeenCalled();
    });

    it('should return null and increment failed attempts on wrong password', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        password: 'hashedpassword',
        isActive: true,
        failedAttempts: 0,
        lockedUntil: null,
      };

      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockUsersService.isAccountLocked.mockReturnValue(false);
      mockUsersService.validatePassword.mockResolvedValue(false);
      mockUsersService.incrementFailedAttempts.mockResolvedValue(undefined);

      const result = await service.validateUser('test@example.com', 'wrongpassword');

      expect(result).toBeNull();
      expect(mockUsersService.incrementFailedAttempts).toHaveBeenCalledWith('123');
    });

    it('should lock account after 5 failed attempts (KAN-46)', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        password: 'hashedpassword',
        isActive: true,
        failedAttempts: 4, // 5th attempt will fail
        lockedUntil: null,
      };

      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockUsersService.isAccountLocked.mockReturnValue(false);
      mockUsersService.validatePassword.mockResolvedValue(false);
      mockUsersService.incrementFailedAttempts.mockResolvedValue(undefined);
      mockUsersService.lockAccount.mockResolvedValue(undefined);

      await service.validateUser('test@example.com', 'wrongpassword');

      expect(mockUsersService.lockAccount).toHaveBeenCalledWith('123');
    });

    it('should reject login when account is locked', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        password: 'hashedpassword',
        isActive: true,
        failedAttempts: 5,
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
      };

      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockUsersService.isAccountLocked.mockReturnValue(true);
      mockUsersService.validatePassword.mockResolvedValue(false);

      // Returns null rather than throwing "Account is temporarily locked".
      // That message is only reachable once the email exists, so it confirms
      // the account to anyone probing.
      await expect(
        service.validateUser('test@example.com', 'password123'),
      ).resolves.toBeNull();
    });

    it('should reject login when account is deactivated (KAN-86)', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        password: 'hashedpassword',
        isActive: false, // DEACTIVATED
        failedAttempts: 0,
        lockedUntil: null,
      };

      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockUsersService.validatePassword.mockResolvedValue(false);

      // Same reasoning as the locked case: indistinguishable from any other
      // failure to the caller, logged for operators.
      await expect(
        service.validateUser('test@example.com', 'password123'),
      ).resolves.toBeNull();
    });

    it('should return null when user not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      const result = await service.validateUser(
        'nonexistent@example.com',
        'password123',
      );

      expect(result).toBeNull();
    });
  });

  describe('refreshToken', () => {
    // Refresh tokens are opaque strings looked up in the database, so these
    // tests stub the stored row rather than a JWT payload.
    const storedRow = { id: 'row-1', userId: '123', revokedAt: null };

    it('should return new tokens on valid refresh token', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        isActive: true,
        role: 'TRADER',
      };

      mockRefreshTokens.findByToken.mockResolvedValue(storedRow);
      mockRefreshTokens.isUsable.mockReturnValue(true);
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('newtoken');

      const result = await service.refreshToken('opaque-refresh-token');

      expect(result.accessToken).toBe('newtoken');
      expect(result.refreshToken).toBe('rotated-refresh-token');
      expect(mockRefreshTokens.rotate).toHaveBeenCalledWith(storedRow);
    });

    it('should throw UnauthorizedException on unknown refresh token', async () => {
      mockRefreshTokens.findByToken.mockResolvedValue(null);

      await expect(
        service.refreshToken('never-issued'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should revoke every session when a spent token is replayed', async () => {
      // A token that exists but is no longer usable was already rotated or
      // revoked. Seeing it again means it leaked, so every live session for
      // that user is ended rather than just refusing this one request.
      mockRefreshTokens.findByToken.mockResolvedValue(storedRow);
      mockRefreshTokens.isUsable.mockReturnValue(false);

      await expect(
        service.refreshToken('already-rotated'),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockRefreshTokens.revokeAllForUser).toHaveBeenCalledWith('123');
    });

    it('should reject refresh token for deactivated user (KAN-86)', async () => {
      mockRefreshTokens.findByToken.mockResolvedValue(storedRow);
      mockRefreshTokens.isUsable.mockReturnValue(true);
      mockUsersService.findById.mockResolvedValue({
        id: '123',
        email: 'test@example.com',
        isActive: false,
      });

      await expect(
        service.refreshToken('valid.but.user.deactivated'),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockRefreshTokens.revoke).toHaveBeenCalledWith(storedRow);
    });

    it('should reject refresh token for deleted user', async () => {
      mockRefreshTokens.findByToken.mockResolvedValue(storedRow);
      mockRefreshTokens.isUsable.mockReturnValue(true);
      mockUsersService.findById.mockRejectedValue(new Error('User not found'));

      await expect(
        service.refreshToken('valid.but.user.deleted'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should revoke the refresh token on logout', async () => {
      const row = { id: 'row-1', userId: '123', revokedAt: null };
      mockRefreshTokens.findByToken.mockResolvedValue(row);

      await service.logout('opaque-refresh-token');

      expect(mockRefreshTokens.revoke).toHaveBeenCalledWith(row);
    });

    it('should not throw when the token is unknown', async () => {
      // Reporting "no such token" would let a caller probe which values are
      // live, so logout succeeds either way.
      mockRefreshTokens.findByToken.mockResolvedValue(null);

      await expect(service.logout('never-issued')).resolves.not.toThrow();
      expect(mockRefreshTokens.revoke).not.toHaveBeenCalled();
    });
  });

  describe('register - Duplicate Detection', () => {
    it('should reject registration with a duplicate email (409)', async () => {
      mockUsersService.create.mockRejectedValue(
        new ConflictException('Email is already in use'),
      );

      await expect(
        service.register('duplicate@example.com', 'password123'),
      ).rejects.toThrow(ConflictException);
    });

    it('should surface the conflict without naming anything but the email', async () => {
      // Email is now the only unique field, so a 409 necessarily confirms the
      // address is registered — that is an enumeration oracle inherent to
      // synchronous registration, not something the message can hide. Closing
      // it properly means always returning 201 and confirming by email, which
      // needs mail infrastructure the BRS puts out of scope (§4.2). What the
      // message must not do is leak anything further.
      mockUsersService.create.mockRejectedValue(
        new ConflictException('Email is already in use'),
      );

      const message = await service
        .register('taken@example.com', 'password123')
        .catch((e: Error) => e.message);

      expect(message).toBe('Email is already in use');
      expect(message).not.toMatch(/username|password|user id|role/i);
    });

    it('should accept registration with an unused email', async () => {
      mockUsersService.create.mockResolvedValue({
        id: '456',
        email: 'unique@example.com',
        role: 'TRADER',
      });
      mockJwtService.sign.mockReturnValue('newtoken');

      const result = await service.register(
        'unique@example.com',
        'password123',
      );

      expect(result.accessToken).toBe('newtoken');
      expect(result.refreshToken).toBe('opaque-refresh-token');
    });
  });

  describe('login - Credential Security', () => {
    it('should not reveal if email is wrong vs password is wrong', async () => {
      const genericErrorMessage = 'Invalid credentials';

      // Case 1: Wrong email
      mockUsersService.findByEmail.mockResolvedValueOnce(null);

      await expect(
        service.login('wrong@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);

      const error1 = await service.login('wrong@example.com', 'password123').catch(
        (e) => e.message,
      );

      // Case 2: Correct email, wrong password
      const mockUser = {
        id: '123',
        email: 'correct@example.com',
        password: 'hashedpassword',
        isActive: true,
        failedAttempts: 0,
        lockedUntil: null,
        role: 'TRADER',
      };

      mockUsersService.findByEmail.mockResolvedValueOnce(mockUser);
      mockUsersService.isAccountLocked.mockReturnValueOnce(false);
      mockUsersService.validatePassword.mockResolvedValueOnce(false);
      mockUsersService.incrementFailedAttempts.mockResolvedValueOnce(undefined);

      await expect(
        service.login('correct@example.com', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);

      const error2 = await service
        .login('correct@example.com', 'wrongpassword')
        .catch((e) => e.message);

      // Both should have same generic message
      expect(error1).toContain(genericErrorMessage);
      expect(error2).toContain(genericErrorMessage);
    });
  });

  describe('Token Claims - RS256', () => {
    it('should generate tokens with all required claims (sub, iss, exp, iat, roles)', async () => {
      const mockUser = {
        id: 'user-uuid-123',
        email: 'test@example.com',
        password: 'hashedpassword',
        isActive: true,
        failedAttempts: 0,
        lockedUntil: null,
        role: 'ADMIN',
      };

      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockUsersService.isAccountLocked.mockReturnValue(false);
      mockUsersService.validatePassword.mockResolvedValue(true);
      mockUsersService.resetFailedAttempts.mockResolvedValue(undefined);

      // Capture what's passed to sign()
      let capturedAccessPayload: any;
      mockJwtService.sign.mockImplementation((payload: any) => {
        capturedAccessPayload = payload;
        return 'token';
      });

      await service.login('test@example.com', 'password123');

      expect(capturedAccessPayload).toHaveProperty('sub', 'user-uuid-123');
      expect(capturedAccessPayload).toHaveProperty('email', 'test@example.com');
      expect(capturedAccessPayload).toHaveProperty('roles', ['ADMIN']);
      expect(capturedAccessPayload).toHaveProperty('iss');
      expect(capturedAccessPayload).toHaveProperty('iat');
      expect(capturedAccessPayload).toHaveProperty('exp');
    });

    it('should set access token expiration to 15 minutes', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        password: 'hashedpassword',
        isActive: true,
        failedAttempts: 0,
        lockedUntil: null,
        role: 'TRADER',
      };

      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockUsersService.isAccountLocked.mockReturnValue(false);
      mockUsersService.validatePassword.mockResolvedValue(true);
      mockUsersService.resetFailedAttempts.mockResolvedValue(undefined);

      let capturedAccessPayload: any;
      mockJwtService.sign.mockImplementation((payload: any) => {
        // Capture the access token payload (first call)
        if (!capturedAccessPayload) {
          capturedAccessPayload = payload;
        }
        return 'token';
      });

      await service.login('test@example.com', 'password123');

      // Access token should expire in 15 minutes (900 seconds)
      const expirationDelta = capturedAccessPayload.exp - capturedAccessPayload.iat;
      expect(expirationDelta).toBe(900);
    });

    it('should sign exactly one JWT, the access token', async () => {
      // The refresh token is an opaque database-backed string, so only the
      // access token is signed. Its 7-day expiry is asserted in
      // refresh-tokens.service.spec.ts, which is where that value now lives.
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        password: 'hashedpassword',
        isActive: true,
        failedAttempts: 0,
        lockedUntil: null,
        role: 'TRADER',
      };

      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockUsersService.isAccountLocked.mockReturnValue(false);
      mockUsersService.validatePassword.mockResolvedValue(true);
      mockUsersService.resetFailedAttempts.mockResolvedValue(undefined);

      const capturedPayloads: any[] = [];
      mockJwtService.sign.mockImplementation((payload: any) => {
        capturedPayloads.push(payload);
        return 'token';
      });

      await service.login('test@example.com', 'password123');

      expect(capturedPayloads).toHaveLength(1);
      expect(capturedPayloads[0].exp - capturedPayloads[0].iat).toBe(900);
      expect(mockRefreshTokens.issue).toHaveBeenCalledWith('123');
    });
  });

  describe('Refresh token revocation', () => {
    // Replaces an earlier in-memory blacklist. That was lost on restart and
    // wrong with more than one replica, and it invalidated the access token
    // rather than the refresh token the acceptance criteria name.
    it('should prevent reuse of a revoked refresh token', async () => {
      const row = { id: 'row-1', userId: '123', revokedAt: new Date() };
      mockRefreshTokens.findByToken.mockResolvedValue(row);
      mockRefreshTokens.isUsable.mockReturnValue(false);

      await expect(
        service.refreshToken('revoked-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should survive a restart because state lives in the database', async () => {
      // A fresh service instance still sees the revocation, because the check
      // is a database lookup rather than process memory.
      mockRefreshTokens.findByToken.mockResolvedValue({
        id: 'row-1',
        userId: '123',
        revokedAt: new Date(),
      });
      mockRefreshTokens.isUsable.mockReturnValue(false);

      await expect(
        service.refreshToken('revoked-before-restart'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
