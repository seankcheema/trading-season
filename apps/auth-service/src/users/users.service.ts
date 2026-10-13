import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UserDto } from './dto/user.dto.js';
import { SignInPublisher } from '../events/sign-in-publisher.service.js';

/** bcrypt cost factor used whenever a password is hashed. */
const BCRYPT_ROUNDS = 10;

/**
 * Owns the credential records. Every change a caller makes to one is also
 * published through SignInPublisher, because the reporting service shows
 * sign-ins and their locks and has no database connection to read them with.
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private signIns: SignInPublisher,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserDto> {
    const existingUser = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });
    if (existingUser) {
      throw new ConflictException('Email is already in use');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, BCRYPT_ROUNDS);

    const user = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    try {
      const savedUser = await this.usersRepository.save(user);
      this.signIns.publish(savedUser);
      return this.mapToDto(savedUser);
    } catch (error) {
      // The check above is a read followed by a write, so two concurrent
      // registrations can both pass it. Postgres still rejects the loser on
      // the unique index; without this the caller would see a raw 500.
      if ((error as { code?: string })?.code === '23505') {
        throw new ConflictException('Email is already in use');
      }
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<UserDto> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.mapToDto(user);
  }

  async validatePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  async incrementFailedAttempts(userId: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.failedAttempts += 1;
    this.signIns.publish(await this.usersRepository.save(user));
  }

  async lockAccount(userId: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Lock for 15 minutes
    const lockedUntil = new Date();
    lockedUntil.setMinutes(lockedUntil.getMinutes() + 15);

    user.lockedUntil = lockedUntil;
    this.signIns.publish(await this.usersRepository.save(user));
  }

  async resetFailedAttempts(userId: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Every successful login lands here. Only one that actually clears a
    // counter or a lock is news to reporting.
    const changed = user.failedAttempts !== 0 || user.lockedUntil !== null;
    user.failedAttempts = 0;
    user.lockedUntil = null;
    const saved = await this.usersRepository.save(user);
    if (changed) {
      this.signIns.publish(saved);
    }
  }

  isAccountLocked(user: User): boolean {
    if (!user.lockedUntil) {
      return false;
    }
    return user.lockedUntil > new Date();
  }

  private mapToDto(user: User): UserDto {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
