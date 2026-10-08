import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity.js';
import type { UserRole } from '../users/user-role.js';
import * as bcrypt from 'bcrypt';

/**
 * The development sign-ins. One per role a developer needs to exercise:
 * - admin@example.com / admin123: a TRADER, for the Client UI
 * - analyst@example.com / analyst123: an ANALYST, for the Reporting UI
 *
 * Registration only ever creates traders, so without the second one there
 * would be no way into the Reporting UI on a fresh development database.
 */
export const SEED_USERS: ReadonlyArray<{
  email: string;
  password: string;
  role: UserRole;
}> = [
  { email: 'admin@example.com', password: 'admin123', role: 'TRADER' },
  { email: 'analyst@example.com', password: 'analyst123', role: 'ANALYST' },
];

/**
 * Seeds default test users for local development.
 * Only runs when NODE_ENV is not 'production'.
 */
@Injectable()
export class SeedService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Creates each development sign-in in SEED_USERS that doesn't exist yet.
   * An existing account is left exactly as it is, role included.
   */
  async seedTestUser(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    for (const seed of SEED_USERS) {
      const existingUser = await this.userRepository.findOne({
        where: { email: seed.email },
      });

      if (!existingUser) {
        const hashedPassword = await bcrypt.hash(seed.password, 10);
        const testUser = this.userRepository.create({
          email: seed.email,
          password: hashedPassword,
          role: seed.role,
        });
        await this.userRepository.save(testUser);
        console.log(
          `✓ Test user created: ${seed.email} / ${seed.password} (${seed.role})`,
        );
      }
    }
  }
}
