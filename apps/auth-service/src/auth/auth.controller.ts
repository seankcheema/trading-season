import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LocalAuthGuard } from './guards/local-auth.guard.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { AuthTokenDto } from './dto/auth-token.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto): Promise<AuthTokenDto> {
    return this.authService.register(registerDto.email, registerDto.password);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Body() loginDto: LoginDto): Promise<AuthTokenDto> {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  // Deliberately unguarded. Refresh exists for when the access token has
  // already expired, so requiring a valid one made the route unusable.
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokenDto> {
    return this.authService.refreshToken(dto.refreshToken);
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
  async logout(@Body() dto: RefreshTokenDto): Promise<{ message: string }> {
    await this.authService.logout(dto.refreshToken);
    return { message: 'Logged out successfully' };
  }
}
