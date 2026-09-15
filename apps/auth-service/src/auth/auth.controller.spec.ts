import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

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

  beforeEach(async () => {
    logout = vi.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      // The login route carries a Passport guard. Nest resolves guard
      // dependencies when the module initialises, not when the route is
      // called, so PassportModule is needed even though login is not exercised.
      imports: [PassportModule.register({})],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: { logout } },
      ],
    }).compile();

    app = module.createNestApplication();
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
      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({})
        .expect(401);

      expect(logout).not.toHaveBeenCalled();
    });
  });
});
