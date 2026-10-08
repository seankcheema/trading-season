import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SEED_USERS, SeedService } from './seed.service.js';
import { User } from '../users/user.entity.js';

vi.mock('bcrypt', () => ({
  hash: vi.fn(async (password: string, _rounds: number) => `hashed_${password}`),
}));

describe('SeedService', () => {
  let service: SeedService;
  let repository: {
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  const originalEnv = process.env.NODE_ENV;

  beforeEach(async () => {
    repository = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn((user: object) => user),
      save: vi.fn(async (user: object) => user),
    };
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeedService,
        { provide: getRepositoryToken(User), useValue: repository },
      ],
    }).compile();

    service = module.get<SeedService>(SeedService);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  it('should create a trader and an analyst sign-in in development', async () => {
    process.env.NODE_ENV = 'development';

    await service.seedTestUser();

    expect(repository.save).toHaveBeenCalledTimes(2);
    expect(repository.create).toHaveBeenCalledWith({
      email: 'admin@example.com',
      password: 'hashed_admin123',
      role: 'TRADER',
    });
    expect(repository.create).toHaveBeenCalledWith({
      email: 'analyst@example.com',
      password: 'hashed_analyst123',
      role: 'ANALYST',
    });
  });

  it('should seed exactly one analyst, since registration cannot create one', () => {
    expect(SEED_USERS.filter((seed) => seed.role === 'ANALYST')).toHaveLength(1);
  });

  it('should leave an existing account as it is, role included', async () => {
    process.env.NODE_ENV = 'development';
    repository.findOne.mockImplementation(
      async ({ where }: { where: { email: string } }) =>
        where.email === 'analyst@example.com'
          ? { email: where.email, role: 'TRADER' }
          : null,
    );

    await service.seedTestUser();

    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'admin@example.com' }),
    );
  });

  it('should seed nothing in production', async () => {
    process.env.NODE_ENV = 'production';

    await service.seedTestUser();

    expect(repository.findOne).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });
});
