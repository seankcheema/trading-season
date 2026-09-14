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
import { RefreshTokensService } from '../refresh-tokens/refresh-tokens.service.js';

/**
 * A valid bcrypt hash of a value nobody knows, compared against when no real
 * hash is available. Keeps every failed-login path costing the same time as a
 * successful one, so response latency does not reveal whether an account
 * exists. The cost factor matches the one used when hashing real passwords.
 */
const DUMMY_BCRYPT_HASH =
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

/**
 * Authentication service implementing RS256 JWT tokens with:
 * - 15-minute access token expiration
 * - Refresh tokens held server-side, so one session can be ended on demand
 * - Claims: sub, iss, exp, iat, roles
 *
 * Access tokens are stateless and stay valid until they expire, so logout
 * leaves a window of up to 15 minutes during which the access token still
 * works. Closing that needs a per-request denylist, which reintroduces exactly
 * the shared state JWTs exist to avoid. Accepted deliberately.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly ACCESS_TOKEN_EXPIRATION = 900; // 15 minutes in seconds

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private refreshTokens: RefreshTokensService,
  ) {}

  async register(
    username: string,
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ): Promise<AuthTokenDto> {
    // Validate input
    if (!username || !email || !password || !firstName || !lastName) {
      throw new BadRequestException('Missing required fields');
    }

    if (password.length < 8) {
      throw new BadRequestException(
        'Password must be at least 8 characters long',
      );
    }

    // Create user
    const createUserDto: CreateUserDto = {
      username,
      email,
      password,
      firstName,
      lastName,
    };

    const user = await this.usersService.create(createUserDto);

    const refreshToken = await this.refreshTokens.issue(user.id);
    return this.issueTokens(user.id, user.email, [user.role], refreshToken);
  }

  async login(
    email: string,
    password: string,
  ): Promise<AuthTokenDto> {
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const refreshToken = await this.refreshTokens.issue(user.id);
    return this.issueTokens(user.id, user.email, [user.role], refreshToken);
  }

  /**
   * Validate credentials, returning null on any failure.
   *
   * Every rejection path is indistinguishable to the caller: unknown account,
   * wrong password, deactivated and locked all produce the same generic 401.
   * Reporting "account is deactivated" or "temporarily locked" is only
   * reachable once the email exists, which makes each one a precise
   * account-enumeration oracle. The reason is logged instead, where operators
   * can see it and callers cannot.
   */
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      // Compare against a throwaway hash anyway. Returning early here would
      // answer in microseconds while a real account costs a bcrypt compare,
      // and that timing difference undoes the generic message above.
      await this.usersService.validatePassword(password, DUMMY_BCRYPT_HASH);
      this.logger.debug(`Login failed: no account for ${email}`);
      return null;
    }

    if (!user.isActive) {
      await this.usersService.validatePassword(password, DUMMY_BCRYPT_HASH);
      this.logger.debug(`Login failed: account ${user.id} is deactivated`);
      return null;
    }

    if (this.usersService.isAccountLocked(user)) {
      await this.usersService.validatePassword(password, DUMMY_BCRYPT_HASH);
      this.logger.debug(`Login failed: account ${user.id} is locked`);
      return null;
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
      this.logger.debug(`Login failed: bad password for account ${user.id}`);
      return null;
    }

    // Reset failed attempts on successful login
    await this.usersService.resetFailedAttempts(user.id);
    return user;
  }

  async validateToken(token: string): Promise<JwtPayload> {
    try {
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
    const row = await this.refreshTokens.findByToken(refreshToken);

    if (!row) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // The row exists but is spent. Either this is a replay of a rotated token,
    // which means it leaked, or a revoked session is being reused. Kill every
    // live session for the user rather than just refusing this one request.
    if (!this.refreshTokens.isUsable(row)) {
      await this.refreshTokens.revokeAllForUser(row.userId);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findById(row.userId).catch(() => null);
    if (!user || !user.isActive) {
      await this.refreshTokens.revoke(row);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const rotated = await this.refreshTokens.rotate(row);
    return this.issueTokens(user.id, user.email, [user.role], rotated);
  }

  /**
   * End one session by revoking its refresh token.
   *
   * Succeeds whether or not the token matched. Reporting "no such token" would
   * turn this into an oracle for probing which token values are live.
   */
  async logout(refreshToken: string): Promise<void> {
    const row = await this.refreshTokens.findByToken(refreshToken);
    if (row) {
      await this.refreshTokens.revoke(row);
      this.logger.debug(`Refresh token revoked for user ${row.userId}`);
    }
  }

  /**
   * Mint an access token and pair it with an already-issued refresh token.
   *
   * The refresh token is an opaque random string, not a JWT. Previously both
   * were JWTs carrying identical claims apart from exp, so an access token was
   * accepted at /auth/refresh and vice versa. Opaque tokens make that
   * confusion impossible, and make revocation a database write.
   */
  private issueTokens(
    userId: string,
    email: string,
    roles: Array<'ADMIN' | 'TRADER'>,
    refreshToken: string,
  ): AuthTokenDto {
    const now = Math.floor(Date.now() / 1000);
    const issuer = process.env.JWT_ISSUER || 'https://auth.dualeapa.com';

    const accessPayload: JwtPayload = {
      sub: userId,
      email,
      roles,
      iss: issuer,
      iat: now,
      exp: now + this.ACCESS_TOKEN_EXPIRATION,
    };

    // No expiresIn here: the payload already carries exp, and jsonwebtoken
    // throws outright when given both. Every test mocks sign(), so this only
    // ever surfaced against a real key.
    const accessToken = this.jwtService.sign(accessPayload, {
      algorithm: 'RS256',
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.ACCESS_TOKEN_EXPIRATION,
    };
  }
}
