import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity.js';
import * as bcrypt from 'bcrypt';

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
   * Creates a default admin test user if it doesn't exist.
   * Use these credentials to login in development:
   * - Email: admin@example.com
   * - Password: admin123
   */
  async seedTestUser(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    const testEmail = 'admin@example.com';
    const existingUser = await this.userRepository.findOne({
      where: { email: testEmail },
    });

    if (!existingUser) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const testUser = this.userRepository.create({
        email: testEmail,
        password: hashedPassword,
      });
      await this.userRepository.save(testUser);
      console.log(`✓ Test user created: ${testEmail} / admin123`);
    }
  }
}
