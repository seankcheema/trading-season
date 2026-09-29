import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, INestApplication } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { LocalStrategy } from './strategies/local.strategy.js';
import { buildValidationPipe } from '../config/validation.config.js';

/**
 * Covers the controller, not the service beneath it.
 *
 * AuthService.logout was already tested and already correct — it revokes
 * whatever refresh token it is handed. The defect was one layer up: the
 * controller pulled the *access* token out of the Authorization header and
 * passed that instead, so the lookup against refresh token hashes matched
 * nothing and the endpoint reported success while revoking nothing. Testing
 * the service in isolation could never have caught it.
 */
describe('AuthController', () => {
  let app: INestApplication;
  let logout: ReturnType<typeof vi.fn>;
  let register: ReturnType<typeof vi.fn>;
  let login: ReturnType<typeof vi.fn>;
  let refreshToken: ReturnType<typeof vi.fn>;
  let validateUser: ReturnType<typeof vi.fn>;
  let requestPasswordReset: ReturnType<typeof vi.fn>;
  let resetPassword: ReturnType<typeof vi.fn>;

  const tokens = {
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresIn: 900,
  };

  beforeEach(async () => {
    logout = vi.fn().mockResolvedValue(undefined);
    register = vi.fn().mockResolvedValue(tokens);
    login = vi.fn().mockResolvedValue(tokens);
    refreshToken = vi.fn().mockResolvedValue(tokens);
    validateUser = vi.fn().mockResolvedValue({ id: 'user-1' });
    requestPasswordReset = vi.fn().mockResolvedValue(undefined);
    resetPassword = vi.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      // The login route carries the real Passport guard, so the real local
      // strategy is registered too; only the service beneath it is stubbed.
      imports: [PassportModule.register({})],
      controllers: [AuthController],
      providers: [
        LocalStrategy,
        {
          provide: AuthService,
          useValue: {
            logout,
            register,
            login,
            refreshToken,
            validateUser,
            requestPasswordReset,
            resetPassword,
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    // The same pipe main.ts installs, from the same factory — a spec that
    // configures its own validation is testing a policy nothing deploys.
    app.useGlobalPipes(buildValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  describe('POST /auth/logout', () => {
    it('should revoke the refresh token from the body', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken: 'the-refresh-token' })
        .expect(201);

      expect(logout).toHaveBeenCalledWith('the-refresh-token');
    });

    it('should never be handed an access token', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', 'Bearer an.access.token')
        .send({ refreshToken: 'the-refresh-token' })
        .expect(201);

      // The regression proper. Passing the bearer value here is what made
      // logout a no-op that still returned 200.
      expect(logout).not.toHaveBeenCalledWith('an.access.token');
      expect(logout).toHaveBeenCalledWith('the-refresh-token');
    });

    it('should work without an access token at all', async () => {
      // Unguarded by design: a client whose 15-minute access token has expired
      // still has to be able to end its session. A JwtAuthGuard here would
      // return 401 exactly when logout is most needed.
      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken: 'the-refresh-token' })
        .expect(201);

      expect(logout).toHaveBeenCalledOnce();
    });

    it('should reject a request carrying no refresh token', async () => {
      // 400, not 401: a body with no token is a malformed request, not a
      // failed authentication. Validation rejects it before the route runs.
      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({})
        .expect(400);

      expect(logout).not.toHaveBeenCalled();
    });

    it('should reject unknown properties instead of ignoring them', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken: 'the-refresh-token', ssn: '000-00-0000' })
        .expect(400);

      // forbidNonWhitelisted. Without it the extra field is stripped in
      // silence and the caller gets a 201 that looks like it worked.
      expect(JSON.stringify(res.body)).toMatch(/ssn/);
      expect(logout).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/register', () => {
    it('should register with the email and password from the body', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'trader@example.com', password: 'long-enough' })
        .expect(201);

      expect(register).toHaveBeenCalledWith('trader@example.com', 'long-enough');
      expect(res.body).toEqual(tokens);
    });

    it('should reject a short password before reaching the service', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'trader@example.com', password: 'short' })
        .expect(400);

      expect(register).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/login', () => {
    it('should issue tokens once the local strategy accepts the credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'trader@example.com', password: 'secret' })
        .expect(201);

      expect(validateUser).toHaveBeenCalledWith('trader@example.com', 'secret');
      expect(login).toHaveBeenCalledWith('trader@example.com', 'secret');
      expect(res.body).toEqual(tokens);
    });

    it('should answer 401 without issuing tokens when the strategy rejects', async () => {
      validateUser.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'trader@example.com', password: 'wrong' })
        .expect(401);

      expect(login).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/refresh', () => {
    it('should rotate the refresh token from the body without an access token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'the-refresh-token' })
        .expect(201);

      expect(refreshToken).toHaveBeenCalledWith('the-refresh-token');
      expect(res.body).toEqual(tokens);
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('should accept the request and pass the address to the service', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'joanna@example.com' })
        .expect(202);

      expect(requestPasswordReset).toHaveBeenCalledWith('joanna@example.com');
      expect(res.body.message).toMatch(/reset link/i);
    });

    it('should answer identically for an address with no account', async () => {
      // The service reports nothing either way, so the only thing that could
      // leak here is the controller doing something different with its result.
      const known = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'joanna@example.com' })
        .expect(202);

      const unknown = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'nobody@example.com' })
        .expect(202);

      expect(unknown.body).toEqual(known.body);
    });
  });

  describe('POST /auth/reset-password', () => {
    it('should pass the emailed token and the new password to the service', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'the-reset-token', password: 'new-password-1' })
        .expect(200);

      expect(resetPassword).toHaveBeenCalledWith('the-reset-token', 'new-password-1');
      expect(res.body.message).toMatch(/reset/i);
    });

    it('should not require an access token', async () => {
      // Someone resetting a password cannot present the credential they have
      // forgotten, which is why this route carries no guard.
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'the-reset-token', password: 'new-password-1' })
        .expect(200);

      expect(resetPassword).toHaveBeenCalled();
    });

    it('should surface a rejected token as a 400', async () => {
      resetPassword.mockRejectedValue(
        new BadRequestException('This password reset link is invalid or has expired'),
      );

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'expired', password: 'new-password-1' })
        .expect(400);
    });

    it('should never return tokens, because the reset ends every session', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'the-reset-token', password: 'new-password-1' })
        .expect(200);

      expect(res.body).not.toHaveProperty('accessToken');
      expect(res.body).not.toHaveProperty('refreshToken');
    });
  });
});
