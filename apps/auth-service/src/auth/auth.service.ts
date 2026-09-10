import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service.js';
import { User } from '../users/user.entity.js';
import { CreateUserDto } from '../users/dto/create-user.dto.js';
import { AuthTokenDto } from './dto/auth-token.dto.js';
import { JwtPayload } from './dto/jwt-payload.dto.js';

/**
 * Authentication service implementing RS256 JWT tokens with:
 * - 15-minute access token expiration
 * - 7-day refresh token expiration
 * - Claims: sub, iss, exp, iat, roles
 * - Token invalidation on logout
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly ACCESS_TOKEN_EXPIRATION = 900; // 15 minutes in seconds
  private readonly REFRESH_TOKEN_EXPIRATION = 604800; // 7 days in seconds
  
  // In production, replace with Redis for distributed token blacklist
  private invalidatedTokens = new Map<string, number>();

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {
    // Cleanup invalidated tokens periodically (every hour)
    setInterval(() => this.cleanupInvalidatedTokens(), 3600000);
  }

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

    // Generate tokens with user's role
    return this.generateTokens(user.id, user.email, [user.role]);
  }

  async login(
    email: string,
    password: string,
  ): Promise<AuthTokenDto> {
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user.id, user.email, [user.role]);
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return null;
    }

    // Check if account is deactivated
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Check if account is locked
    if (this.usersService.isAccountLocked(user)) {
      throw new UnauthorizedException('Account is temporarily locked');
    }

    const isPasswordValid = await this.usersService.validatePassword(
      password,
      user.password,
    );

    if (!isPasswordValid) {
      // Increment failed attempts and lock if >= 5
      await this.usersService.incrementFailedAttempts(user.id);
      if (user.failedAttempts + 1 >= 5) {
        await this.usersService.lockAccount(user.id);
      }
      return null;
    }

    // Reset failed attempts on successful login
    await this.usersService.resetFailedAttempts(user.id);
    return user;
  }

  async validateToken(token: string): Promise<JwtPayload> {
    try {
      // Check if token is in blacklist
      if (this.isTokenInvalidated(token)) {
        throw new UnauthorizedException('Token has been invalidated');
      }

      const payload = this.jwtService.verify<JwtPayload>(token);
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid token');
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthTokenDto> {
    try {
      // Check if token is in blacklist
      if (this.isTokenInvalidated(refreshToken)) {
        throw new UnauthorizedException('Refresh token has been invalidated');
      }

      const payload = this.jwtService.verify<JwtPayload>(refreshToken);

      // Verify user still exists and is active
      const user = await this.usersService.findById(payload.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('User is no longer valid');
      }

      // Generate new tokens with fresh user data
      return this.generateTokens(payload.sub, payload.email, [user.role]);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.debug('Token refresh failed:', error);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Invalidate a token (for logout)
   * In production, this should be stored in Redis with TTL
   */
  async logout(token: string): Promise<void> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      // Add token to blacklist with its expiration time
      this.invalidatedTokens.set(token, payload.exp);
      this.logger.debug(`Token invalidated for user ${payload.sub}`);
    } catch (error) {
      this.logger.warn('Failed to invalidate token:', error);
      // Don't throw - logout should succeed even if token is already invalid
    }
  }

  /**
   * Generate access and refresh tokens
   */
  private generateTokens(
    userId: string,
    email: string,
    roles: Array<'ADMIN' | 'TRADER'>,
  ): AuthTokenDto {
    const now = Math.floor(Date.now() / 1000);
    const issuer = process.env.JWT_ISSUER || 'https://auth.dualeapa.com';

    // Access token payload with required claims
    const accessPayload: JwtPayload = {
      sub: userId,
      email,
      roles,
      iss: issuer,
      iat: now,
      exp: now + this.ACCESS_TOKEN_EXPIRATION,
    };

    // Sign access token
    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: this.ACCESS_TOKEN_EXPIRATION,
      algorithm: 'RS256',
    });

    // Refresh token payload
    const refreshPayload: JwtPayload = {
      ...accessPayload,
      exp: now + this.REFRESH_TOKEN_EXPIRATION,
    };

    // Sign refresh token
    const refreshToken = this.jwtService.sign(refreshPayload, {
      expiresIn: this.REFRESH_TOKEN_EXPIRATION,
      algorithm: 'RS256',
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.ACCESS_TOKEN_EXPIRATION,
    };
  }

  /**
   * Check if token is in the invalidated tokens list
   */
  private isTokenInvalidated(token: string): boolean {
    const expTime = this.invalidatedTokens.get(token);
    if (!expTime) {
      return false;
    }

    // Token is no longer considered invalidated after expiration
    const now = Math.floor(Date.now() / 1000);
    if (now > expTime) {
      this.invalidatedTokens.delete(token);
      return false;
    }

    return true;
  }

  /**
   * Remove expired tokens from blacklist
   * This runs periodically to prevent unbounded memory growth
   */
  private cleanupInvalidatedTokens(): void {
    const now = Math.floor(Date.now() / 1000);
    let removedCount = 0;

    for (const [token, expTime] of this.invalidatedTokens.entries()) {
      if (now > expTime) {
        this.invalidatedTokens.delete(token);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.debug(
        `Cleaned up ${removedCount} expired tokens from blacklist`,
      );
    }
  }
}
