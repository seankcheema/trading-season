import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
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
      expect(result.expiresIn).toBe(3600);
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
      const mockPayload = { sub: '123', email: 'test@example.com' };

      mockJwtService.verify.mockReturnValue(mockPayload);
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
  });
});
