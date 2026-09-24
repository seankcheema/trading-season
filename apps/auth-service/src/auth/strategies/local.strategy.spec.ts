import { UnauthorizedException } from '@nestjs/common';
import { describe, it, expect, vi } from 'vitest';
import { LocalStrategy } from './local.strategy.js';
import { AuthService } from '../auth.service.js';
import { User } from '../../users/user.entity.js';

describe('LocalStrategy', () => {
  const build = (validateUser: ReturnType<typeof vi.fn>) =>
    new LocalStrategy({ validateUser } as unknown as AuthService);

  it('should return the user the auth service validates', async () => {
    const user = { id: 'user-1', email: 'trader@example.com' } as User;
    const validateUser = vi.fn().mockResolvedValue(user);

    await expect(
      build(validateUser).validate('trader@example.com', 'secret'),
    ).resolves.toBe(user);
    expect(validateUser).toHaveBeenCalledWith('trader@example.com', 'secret');
  });

  it('should reject with a generic credential error when validation fails', async () => {
    const validateUser = vi.fn().mockResolvedValue(null);

    const attempt = build(validateUser).validate('trader@example.com', 'wrong');

    await expect(attempt).rejects.toThrow(UnauthorizedException);
    await expect(
      build(validateUser).validate('trader@example.com', 'wrong'),
    ).rejects.toThrow('Invalid credentials');
  });
});
