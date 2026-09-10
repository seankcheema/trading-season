import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { LocalStrategy } from './strategies/local.strategy.js';
import { JwtKeysService } from './services/jwt-keys.service.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      privateKey: process.env.JWT_PRIVATE_KEY,
      publicKey: process.env.JWT_PUBLIC_KEY,
      signOptions: {
        algorithm: 'RS256',
        expiresIn: '15m',
        issuer: process.env.JWT_ISSUER || 'https://auth.dualeapa.com',
      },
    }),
    UsersModule,
  ],
  providers: [
    JwtKeysService,
    AuthService,
    LocalStrategy,
  ],
  controllers: [AuthController],
  exports: [AuthService, JwtKeysService],
})
export class AuthModule {}
