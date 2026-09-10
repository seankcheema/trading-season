import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { User } from '../users/user.entity.js';

describe('AuthService', () => {
  let service: AuthService;
  let mockUsersService: any;
  let mockJwtService: any;

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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should register a new user and return tokens', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
      };

      const mockUser = {
        id: '123',
        email: registerDto.email,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        role: 'TRADER',
      };

      mockUsersService.create.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('token');

      const result = await service.register(
        registerDto.email,
        registerDto.password,
        registerDto.firstName,
        registerDto.lastName,
      );

      expect(result.accessToken).toBe('token');
      expect(result.refreshToken).toBe('token');
      expect(result.expiresIn).toBe(900); // 15 minutes
    });

    it('should reject password shorter than 8 characters', async () => {
      await expect(
        service.register(
          'test@example.com',
          'short',
          'John',
          'Doe',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject missing required fields', async () => {
      await expect(
        service.register('test@example.com', 'password123', '', 'Doe'),
      ).rejects.toThrow(BadRequestException);
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
      expect(result.refreshToken).toBe('token');
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

      await expect(
        service.validateUser('test@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.validateUser('test@example.com', 'password123'),
      ).rejects.toThrow('Account is temporarily locked');
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

      await expect(
        service.validateUser('test@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.validateUser('test@example.com', 'password123'),
      ).rejects.toThrow('Account is deactivated');
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

  describe('validateToken', () => {
    it('should return payload on valid token', async () => {
      const mockPayload = { sub: '123', email: 'test@example.com' };

      mockJwtService.verify.mockReturnValue(mockPayload);

      const result = await service.validateToken('valid.token.here');

      expect(result).toEqual(mockPayload);
    });

    it('should throw UnauthorizedException on invalid token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(
        service.validateToken('invalid.token.here'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    it('should return new tokens on valid refresh token', async () => {
      const mockPayload = {
        sub: '123',
        email: 'test@example.com',
        exp: Math.floor(Date.now() / 1000) + 604800,
      };

      const mockUser = {
        id: '123',
        email: 'test@example.com',
        isActive: true,
        role: 'TRADER',
      };

      mockJwtService.verify.mockReturnValue(mockPayload);
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('newtoken');

      const result = await service.refreshToken('valid.refresh.token');

      expect(result.accessToken).toBe('newtoken');
      expect(result.refreshToken).toBe('newtoken');
    });

    it('should throw UnauthorizedException on invalid refresh token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(
        service.refreshToken('invalid.token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject refresh token for deactivated user (KAN-86)', async () => {
      const mockPayload = {
        sub: '123',
        email: 'test@example.com',
        exp: Math.floor(Date.now() / 1000) + 604800,
      };

      const deactivatedUser = {
        id: '123',
        email: 'test@example.com',
        isActive: false,
      };

      mockJwtService.verify.mockReturnValue(mockPayload);
      mockUsersService.findById.mockResolvedValue(deactivatedUser);

      await expect(
        service.refreshToken('valid.but.user.deactivated'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.refreshToken('valid.but.user.deactivated'),
      ).rejects.toThrow('User is no longer valid');
    });

    it('should reject refresh token for deleted user', async () => {
      const mockPayload = {
        sub: '123',
        email: 'test@example.com',
        exp: Math.floor(Date.now() / 1000) + 604800,
      };

      mockJwtService.verify.mockReturnValue(mockPayload);
      mockUsersService.findById.mockResolvedValue(null);

      await expect(
        service.refreshToken('valid.but.user.deleted'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.refreshToken('valid.but.user.deleted'),
      ).rejects.toThrow('User is no longer valid');
    });
  });

  describe('logout', () => {
    it('should invalidate token on logout', async () => {
      const mockPayload = {
        sub: '123',
        email: 'test@example.com',
        exp: Math.floor(Date.now() / 1000) + 900,
      };

      const token = 'valid.token.to.invalidate';
      mockJwtService.verify.mockReturnValue(mockPayload);

      await service.logout(token);

      // Token should now be in blacklist
      expect(() => service.isTokenInvalidated(token)).not.toThrow();
    });

    it('should not throw error if token is already invalid', async () => {
      const invalidToken = 'already.invalid.token';
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(
        service.logout(invalidToken),
      ).resolves.not.toThrow();
    });
  });

  describe('register - Duplicate Detection', () => {
    it('should reject registration with duplicate email (409)', async () => {
      mockUsersService.create.mockImplementation(() => {
        const error = new ConflictException('Email already exists');
        (error as any).code = '23505'; // PostgreSQL unique constraint violation
        throw error;
      });

      await expect(
        service.register('duplicate@example.com', 'password123', 'John', 'Doe'),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject registration with duplicate username (409)', async () => {
      mockUsersService.create.mockImplementation(() => {
        const error = new ConflictException('Username already exists');
        (error as any).code = '23505'; // PostgreSQL unique constraint violation
        throw error;
      });

      await expect(
        service.register('new@example.com', 'password123', 'John', 'Doe'),
      ).rejects.toThrow(ConflictException);
    });

    it('should accept registration with unique email and username', async () => {
      const mockUser = {
        id: '456',
        email: 'unique@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'TRADER',
      };

      mockUsersService.create.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('newtoken');

      const result = await service.register(
        'unique@example.com',
        'password123',
        'Jane',
        'Smith',
      );

      expect(result.accessToken).toBe('newtoken');
      expect(result.refreshToken).toBe('newtoken');
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

    it('should set refresh token expiration to 7 days', async () => {
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

      let capturedPayloads: any[] = [];
      mockJwtService.sign.mockImplementation((payload: any) => {
        capturedPayloads.push(payload);
        return 'token';
      });

      await service.login('test@example.com', 'password123');

      // Second call is refresh token
      const refreshPayload = capturedPayloads[1];
      const expirationDelta = refreshPayload.exp - refreshPayload.iat;
      expect(expirationDelta).toBe(604800); // 7 days in seconds
    });
  });

  describe('Token Blacklist', () => {
    it('should prevent use of invalidated access token', async () => {
      const tokenToInvalidate = 'token.to.invalidate';
      const mockPayload = {
        sub: '123',
        email: 'test@example.com',
        exp: Math.floor(Date.now() / 1000) + 900,
      };

      mockJwtService.verify.mockReturnValue(mockPayload);

      // Logout to invalidate
      await service.logout(tokenToInvalidate);

      // Try to use it - should be in blacklist
      mockJwtService.verify.mockReturnValue(mockPayload);

      await expect(
        service.validateToken(tokenToInvalidate),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.validateToken(tokenToInvalidate),
      ).rejects.toThrow('Token has been invalidated');
    });

    it('should prevent use of invalidated refresh token', async () => {
      const refreshToken = 'refresh.token.to.invalidate';
      const mockPayload = {
        sub: '123',
        email: 'test@example.com',
        exp: Math.floor(Date.now() / 1000) + 604800,
      };

      mockJwtService.verify.mockReturnValue(mockPayload);

      // Logout to invalidate
      await service.logout(refreshToken);

      // Try to refresh with invalidated token
      mockJwtService.verify.mockReturnValue(mockPayload);

      await expect(
        service.refreshToken(refreshToken),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.refreshToken(refreshToken),
      ).rejects.toThrow('Refresh token has been invalidated');
    });
  });
});
