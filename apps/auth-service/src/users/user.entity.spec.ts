import { describe, it, expect } from 'vitest';
import { User } from './user.entity.js';

/**
 * The business schema stores deactivation as `account_status`, a string, while
 * every caller reads the boolean `isActive`. Nothing else tests that
 * translation: the fixtures in the other specs are plain objects that set
 * `isActive` directly, so they would keep passing if this entity stopped
 * deriving it correctly.
 */
describe('User.isActive', () => {
  it('should read ACTIVE as active', () => {
    const user = new User();
    user.accountStatus = 'ACTIVE';
    expect(user.isActive).toBe(true);
  });

  it('should read DEACTIVATED as inactive', () => {
    const user = new User();
    user.accountStatus = 'DEACTIVATED';
    expect(user.isActive).toBe(false);
  });

  it('should not treat an unset status as active', () => {
    // A row selected without account_status — a partial projection, or a
    // column dropped by a later migration — must not silently authenticate.
    expect(new User().isActive).toBe(false);
  });
});
