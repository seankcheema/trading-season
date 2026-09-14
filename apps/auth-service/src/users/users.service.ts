import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UserDto } from './dto/user.dto.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserDto> {
    // Both fields carry a unique index, so both must be checked. The message
    // deliberately does not say which one matched — naming the field turns
    // registration into a precise account-enumeration oracle.
    const where: Array<Record<string, string>> = [
      { email: createUserDto.email },
    ];
    if (createUserDto.username) {
      where.push({ username: createUserDto.username });
    }

    const existingUser = await this.usersRepository.findOne({ where });
    if (existingUser) {
      throw new ConflictException('Username or email is already in use');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    try {
      const savedUser = await this.usersRepository.save(user);
      return this.mapToDto(savedUser);
    } catch (error) {
      // The check above is a read followed by a write, so two concurrent
      // registrations can both pass it. Postgres still rejects the loser on
      // the unique index; without this the caller would see a raw 500.
      if ((error as { code?: string })?.code === '23505') {
        throw new ConflictException('Username or email is already in use');
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
    await this.usersRepository.save(user);
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
    await this.usersRepository.save(user);
  }

  async resetFailedAttempts(userId: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.failedAttempts = 0;
    user.lockedUntil = null;
    await this.usersRepository.save(user);
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
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
