import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBody, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { LocalAuthGuard } from './guards/local-auth.guard.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { AuthTokenDto } from './dto/auth-token.dto.js';

@ApiTags('authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: AuthTokenDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid email or password format',
  })
  @ApiResponse({
    status: 409,
    description: 'Email already registered',
  })
  @HttpCode(HttpStatus.CREATED)
  @Post('register')
  async register(@Body() registerDto: RegisterDto): Promise<AuthTokenDto> {
    return this.authService.register(registerDto.email, registerDto.password);
  }

  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 201,
    description: 'Login successful',
    type: AuthTokenDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid credentials format',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid email or password',
  })
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Body() loginDto: LoginDto): Promise<AuthTokenDto> {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @ApiOperation({
    summary: 'Refresh access token using refresh token',
    description: 'Deliberately unguarded. Refresh exists for when the access token has already expired, so requiring a valid one made the route unusable.',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 201,
    description: 'Token refreshed successfully',
    type: AuthTokenDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired refresh token',
  })
  @HttpCode(HttpStatus.CREATED)
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokenDto> {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @ApiOperation({
    summary: 'Logout and revoke refresh token',
    description: 'End one session by revoking its refresh token. Takes the refresh token from the body. Unguarded for the same reason /auth/refresh is: a client whose access token has already expired still needs to be able to end its session.',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 201,
    description: 'Logged out successfully',
    schema: { properties: { message: { type: 'string' } } },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid refresh token',
  })
  @HttpCode(HttpStatus.CREATED)
  @Post('logout')
  async logout(@Body() dto: RefreshTokenDto): Promise<{ message: string }> {
    await this.authService.logout(dto.refreshToken);
    return { message: 'Logged out successfully' };
  }
}
