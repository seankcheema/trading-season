import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UsersService } from './users.service.js';
import { User } from './user.entity.js';

vi.mock('bcrypt', () => ({
  hash: vi.fn(async (password: string, _rounds: number) => `hashed_${password}`),
  compare: vi.fn(async (password: string, hash: string) => password === hash.replace('hashed_', '')),
}));

describe('UsersService', () => {
  let service: UsersService;
  let mockUserRepository: any;

  beforeEach(async () => {
    mockUserRepository = {
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('create', () => {
    it('should hash password and save user', async () => {
      const createUserDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockUser = {
        id: '123',
        ...createUserDto,
        password: 'hashedpassword',
        isActive: true,
        failedAttempts: 0,
        lockedUntil: null,
        role: 'TRADER',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      const result = await service.create(createUserDto);

      expect(result.email).toBe(createUserDto.email);
      expect(result.id).toBe('123');
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('should reject duplicate email with 409', async () => {
      const createUserDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      mockUserRepository.findOne.mockResolvedValue({ id: '123' });

      await expect(service.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createUserDto)).rejects.toThrow(
        'Email is already in use',
      );
    });

    it('should map a unique-index violation from a concurrent registration to 409', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue({});
      mockUserRepository.save.mockRejectedValue({ code: '23505' });

      await expect(
        service.create({ email: 'test@example.com', password: 'password123' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should rethrow any other persistence failure unchanged', async () => {
      const failure = new Error('connection reset');
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue({});
      mockUserRepository.save.mockRejectedValue(failure);

      await expect(
        service.create({ email: 'test@example.com', password: 'password123' }),
      ).rejects.toBe(failure);
    });

    it('should store the bcrypt hash rather than the plaintext password', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockImplementation((u: object) => u);
      mockUserRepository.save.mockImplementation(async (u: object) => u);

      await service.create({ email: 'test@example.com', password: 'password123' });

      expect(mockUserRepository.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'hashed_password123',
      });
    });
  });

  describe('findById', () => {
    it('should return the public view of the user without the password hash', async () => {
      const createdAt = new Date();
      mockUserRepository.findOne.mockResolvedValue({
        id: '123',
        email: 'test@example.com',
        password: 'hashedpassword',
        isActive: true,
        role: 'TRADER',
        createdAt,
        updatedAt: createdAt,
      });

      const result = await service.findById('123');

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: '123' } });
      expect(result).toEqual({
        id: '123',
        email: 'test@example.com',
        isActive: true,
        role: 'TRADER',
        createdAt,
        updatedAt: createdAt,
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmail', () => {
    it('should return user if found', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        password: 'hashedpassword',
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('validatePassword', () => {
    it('should return true for valid password', async () => {
      const result = await service.validatePassword('password123', 'hashed_password123');

      expect(result).toBe(true);
    });

    it('should return false for invalid password', async () => {
      const result = await service.validatePassword('wrongpassword', 'hashed_password123');

      expect(result).toBe(false);
    });
  });

  describe('incrementFailedAttempts', () => {
    it('should increment failed attempts', async () => {
      const mockUser = {
        id: '123',
        failedAttempts: 0,
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue({
        ...mockUser,
        failedAttempts: 1,
      });

      await service.incrementFailedAttempts('123');

      expect(mockUser.failedAttempts).toBe(1);
      expect(mockUserRepository.save).toHaveBeenCalledWith(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.incrementFailedAttempts('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('lockAccount', () => {
    it('should set lockedUntil to 15 minutes from now', async () => {
      const mockUser = {
        id: '123',
        lockedUntil: null,
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      await service.lockAccount('123');

      expect(mockUser.lockedUntil).toBeDefined();
      expect(mockUser.lockedUntil.getTime()).toBeGreaterThan(new Date().getTime());
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.lockAccount('nonexistent')).rejects.toThrow(NotFoundException);
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('resetFailedAttempts', () => {
    it('should reset failed attempts and clear lock', async () => {
      const mockUser = {
        id: '123',
        failedAttempts: 5,
        lockedUntil: new Date(),
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue({
        ...mockUser,
        failedAttempts: 0,
        lockedUntil: null,
      });

      await service.resetFailedAttempts('123');

      expect(mockUser.failedAttempts).toBe(0);
      expect(mockUser.lockedUntil).toBeNull();
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.resetFailedAttempts('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('isAccountLocked', () => {
    it('should return true if account is locked', () => {
      const futureDate = new Date();
      futureDate.setMinutes(futureDate.getMinutes() + 5);

      const mockUser = {
        id: '123',
        lockedUntil: futureDate,
      };

      const result = service.isAccountLocked(mockUser as User);

      expect(result).toBe(true);
    });

    it('should return false if lock has expired', () => {
      const pastDate = new Date();
      pastDate.setMinutes(pastDate.getMinutes() - 5);

      const mockUser = {
        id: '123',
        lockedUntil: pastDate,
      };

      const result = service.isAccountLocked(mockUser as User);

      expect(result).toBe(false);
    });

    it('should return false if lockedUntil is null', () => {
      const mockUser = {
        id: '123',
        lockedUntil: null,
      };

      const result = service.isAccountLocked(mockUser as User);

      expect(result).toBe(false);
    });
  });
});
