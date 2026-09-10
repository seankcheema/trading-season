import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service.js';
import { User } from '../users/user.entity.js';
import { CreateUserDto } from '../users/dto/create-user.dto.js';
import { AuthTokenDto } from './dto/auth-token.dto.js';
import { JwtPayload } from './strategies/jwt.strategy.js';

@Injectable()
export class AuthService {
  private readonly JWT_EXPIRATION = 3600; // 1 hour in seconds

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ): Promise<AuthTokenDto> {
    // Validate input
    if (!email || !password || !firstName || !lastName) {
      throw new BadRequestException('Missing required fields');
    }

    if (password.length < 8) {
      throw new BadRequestException(
        'Password must be at least 8 characters long',
      );
    }

    // Create user
    const createUserDto: CreateUserDto = {
      email,
      password,
      firstName,
      lastName,
    };

    const user = await this.usersService.create(createUserDto);

    // Generate tokens
    return this.generateTokens(user.id, user.email);
  }

  async login(
    email: string,
    password: string,
  ): Promise<AuthTokenDto> {
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user.id, user.email);
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return null;
    }

    const isPasswordValid = await this.usersService.validatePassword(
      password,
      user.password,
    );

    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async validateToken(token: string): Promise<JwtPayload> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthTokenDto> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken);
      return this.generateTokens(payload.sub, payload.email);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private generateTokens(userId: string, email: string): AuthTokenDto {
    const payload: JwtPayload = { sub: userId, email };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.JWT_EXPIRATION,
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.JWT_EXPIRATION,
    };
  }
}
