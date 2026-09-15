import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LocalAuthGuard } from './guards/local-auth.guard.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { AuthTokenDto } from './dto/auth-token.dto.js';
import { JwtPayload } from './dto/jwt-payload.dto.js';

interface RequestWithUser extends Request {
  user?: JwtPayload;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto): Promise<AuthTokenDto> {
    return this.authService.register(
      registerDto.username,
      registerDto.email,
      registerDto.password,
      registerDto.firstName,
      registerDto.lastName,
    );
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Body() loginDto: LoginDto): Promise<AuthTokenDto> {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  // Deliberately unguarded. Refresh exists for when the access token has
  // already expired, so requiring a valid one made the route unusable.
  @Post('refresh')
  async refresh(@Req() req: RequestWithUser): Promise<AuthTokenDto> {
    const refreshToken = this.extractRefreshToken(req);
    return this.authService.refreshToken(refreshToken);
  }

  /**
   * End one session by revoking its refresh token.
   *
   * Takes the refresh token from the body, not the access token from the
   * Authorization header. It previously took the latter and passed it to
   * AuthService.logout, which looks the value up against refresh token hashes —
   * so it matched nothing, revoked nothing, and reported success anyway.
   *
   * Unguarded for the same reason /auth/refresh is: a client whose access token
   * has already expired still needs to be able to end its session. Possession
   * of the refresh token is the credential here.
   */
  @Post('logout')
  async logout(@Req() req: RequestWithUser): Promise<{ message: string }> {
    const refreshToken = this.extractRefreshToken(req);
    await this.authService.logout(refreshToken);
    return { message: 'Logged out successfully' };
  }

  /**
   * Extract refresh token from request body or cookies
   */
  private extractRefreshToken(req: RequestWithUser): string {
    const refreshToken =
      (req as any).body?.refreshToken || (req as any).cookies?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }
    return refreshToken;
  }
}
