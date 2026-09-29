import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LocalAuthGuard } from './guards/local-auth.guard.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
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

  /**
   * Ask for a password reset link (KAN-89).
   *
   * 202, and the same body, for every address: a known account, an unknown one
   * and a deactivated one are indistinguishable here, because this route takes
   * no credentials and would otherwise tell anyone who asks which email
   * addresses are registered. Accepted rather than OK for the same reason — the
   * response says the request was taken, not that an email went anywhere.
   */
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('forgot-password')
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.requestPasswordReset(dto.email);
    return {
      message: 'If that email has an account, a reset link is on its way.',
    };
  }

  /**
   * Set a new password using the token from the emailed link.
   *
   * Unguarded, like /auth/refresh and /auth/logout: the emailed token is the
   * credential, and someone resetting a password by definition cannot present
   * the one they have forgotten. Returns no tokens — the reset revokes every
   * existing session, so the client signs in again with the new password.
   */
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.resetPassword(dto.token, dto.password);
    return { message: 'Your password has been reset. Sign in with your new password.' };
  }
}
