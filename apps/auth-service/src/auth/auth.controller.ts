import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { JwtKeysService, Jwks } from './services/jwt-keys.service.js';
import { LocalAuthGuard } from './guards/local-auth.guard.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
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

  constructor(
    private authService: AuthService,
    private jwtKeysService: JwtKeysService,
  ) {}

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

  @UseGuards(JwtAuthGuard)
  @Get('verify')
  async verify(@Req() req: RequestWithUser): Promise<{
    valid: boolean;
    user?: JwtPayload;
  }> {
    return {
      valid: !!req.user,
      user: req.user,
    };
  }

  /**
   * Logout endpoint - invalidates the access token
   * The token is extracted from Authorization header
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: RequestWithUser): Promise<{ message: string }> {
    const token = this.extractToken(req);
    await this.authService.logout(token);
    this.logger.debug(`User ${req.user?.sub} logged out`);
    return { message: 'Logged out successfully' };
  }


  /**
   * Extract JWT from Authorization header
   */
  private extractToken(req: RequestWithUser): string {
    const authHeader = (req as any).headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No authorization token provided');
    }
    return authHeader.substring(7);
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
