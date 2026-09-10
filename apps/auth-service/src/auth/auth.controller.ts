import { Controller, Post, Body, UseGuards, Req, Get } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LocalAuthGuard } from './guards/local-auth.guard.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { AuthTokenDto } from './dto/auth-token.dto.js';

interface RequestWithUser extends Request {
  user?: { userId: string; email: string };
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto): Promise<AuthTokenDto> {
    return this.authService.register(
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

  @UseGuards(JwtAuthGuard)
  @Post('refresh')
  async refresh(@Req() req: RequestWithUser): Promise<AuthTokenDto> {
    const refreshToken = this.extractRefreshToken(req);
    return this.authService.refreshToken(refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('verify')
  async verify(@Req() req: RequestWithUser): Promise<{ valid: boolean }> {
    return { valid: !!req.user };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(): Promise<{ message: string }> {
    return { message: 'Logged out successfully' };
  }

  private extractRefreshToken(req: RequestWithUser): string {
    // In a real app, you'd extract the refresh token from the request body or cookies
    const authHeader = (req.headers as any).authorization;
    if (!authHeader) {
      throw new Error('No refresh token provided');
    }
    return authHeader.replace('Bearer ', '');
  }
}
