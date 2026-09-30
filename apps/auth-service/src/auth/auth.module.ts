import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { WellKnownController } from './well-known.controller.js';
import { LocalStrategy } from './strategies/local.strategy.js';
import { JwtKeysService, normalizePem } from './services/jwt-keys.service.js';
import { UsersModule } from '../users/users.module.js';
import { RefreshTokensModule } from '../refresh-tokens/refresh-tokens.module.js';

/**
 * The signing configuration the service actually runs on.
 *
 * Exported, and built by a function rather than declared inline, so that tests
 * can sign through this exact configuration instead of a hand-rolled JwtService
 * of their own. Every existing spec built its own, which is why a module that
 * could not issue a single token passed 62 tests.
 */
export function buildJwtOptions(): JwtModuleOptions {
  return {
    // normalizePem is the same helper JwtKeysService uses. Reading the raw
    // env value here instead would mean the two disagreed about escaped
    // newlines: verification would work while signing silently failed.
    privateKey: normalizePem(process.env.JWT_PRIVATE_KEY),
    publicKey: normalizePem(process.env.JWT_PUBLIC_KEY),
    // Only the algorithm belongs here. AuthService.issueTokens sets exp and
    // iss as payload claims, and @nestjs/jwt merges these module options into
    // every sign() call — so an expiresIn or issuer here reaches jsonwebtoken
    // alongside the claims it duplicates, and it rejects that outright with
    // `Bad "options.expiresIn" option the payload already has an "exp"
    // property`. That made every login and register a 500.
    signOptions: {
      algorithm: 'RS256',
    },
  };
}

@Module({
  imports: [
    PassportModule.register({ session: false }),
    // registerAsync so the options are built at injection time, after the
    // process has its environment. register() would capture process.env as the
    // file is imported.
    JwtModule.registerAsync({ useFactory: buildJwtOptions }),
    UsersModule,
    RefreshTokensModule,
  ],
  providers: [
    JwtKeysService,
    AuthService,
    // LocalStrategy only. There is no JWT strategy because this service never
    // validates its own access tokens — the backend does that locally against
    // the published JWKS document, which is why /auth/verify is gone too.
    LocalStrategy,
  ],
  controllers: [AuthController, WellKnownController],
  exports: [AuthService, JwtKeysService],
})
export class AuthModule {}
