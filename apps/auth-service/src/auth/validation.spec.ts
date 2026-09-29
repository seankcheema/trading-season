import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { buildValidationPipe } from '../config/validation.config.js';

/**
 * Request validation at the HTTP boundary.
 *
 * The DTOs were type-only until class-validator was added: TypeScript shaped
 * them at compile time and nothing enforced them at runtime, so a number was
 * an acceptable email address and nine unexpected fields were silently
 * discarded behind a 201.
 */
describe('request validation', () => {
  let app: INestApplication;
  let register: ReturnType<typeof vi.fn>;
  let requestPasswordReset: ReturnType<typeof vi.fn>;
  let resetPassword: ReturnType<typeof vi.fn>;

  const tokens = {
    accessToken: 'a.b.c',
    refreshToken: 'opaque',
    expiresIn: 900,
  };

  beforeEach(async () => {
    register = vi.fn().mockResolvedValue(tokens);
    requestPasswordReset = vi.fn().mockResolvedValue(undefined);
    resetPassword = vi.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      imports: [PassportModule.register({})],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register,
            login: vi.fn(),
            logout: vi.fn(),
            requestPasswordReset,
            resetPassword,
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(buildValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  describe('POST /auth/register', () => {
    it('should accept a well-formed body', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'joanna@example.com', password: 'correct-horse' })
        .expect(201);

      expect(register).toHaveBeenCalledWith(
        'joanna@example.com',
        'correct-horse',
      );
    });

    it('should reject a non-string email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 12345, password: 'correct-horse' })
        .expect(400);

      expect(register).not.toHaveBeenCalled();
    });

    it('should reject a value that is not an email address', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'hello', password: 'correct-horse' })
        .expect(400);

      expect(register).not.toHaveBeenCalled();
    });

    it('should reject a password under 8 characters', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'joanna@example.com', password: 'short' })
        .expect(400);

      expect(register).not.toHaveBeenCalled();
    });

    it('should name the fields it did not expect', async () => {
      // The case the frontend will actually hit: the registration form
      // collects eleven fields and this endpoint takes two. A 400 listing the
      // extras tells them where the rest belong; stripping them in silence
      // would return 201 and lose the profile data with no trace.
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'joanna@example.com',
          password: 'correct-horse',
          firstName: 'Joanna',
          lastName: 'Reed',
          ssn: '000-00-0000',
          availableFunds: 1000000,
        })
        .expect(400);

      const body = JSON.stringify(res.body);
      expect(body).toMatch(/firstName/);
      expect(body).toMatch(/ssn/);
      expect(body).toMatch(/availableFunds/);
      expect(register).not.toHaveBeenCalled();
    });

    it('should reject a role supplied by the caller', async () => {
      // RegisterDto has no role field, and forbidNonWhitelisted is what turns
      // that absence into a rejection. Without it the property is stripped
      // quietly, which is safe today only because register() builds its own
      // CreateUserDto field by field.
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'joanna@example.com',
          password: 'correct-horse',
          role: 'ADMIN',
        })
        .expect(400);

      expect(register).not.toHaveBeenCalled();
    });

    it('should reject a password longer than bcrypt reads', async () => {
      // bcrypt ignores bytes past 72. Accepting more would mean two different
      // passwords authenticating the same account.
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'joanna@example.com', password: 'x'.repeat(73) })
        .expect(400);

      expect(register).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('should accept a well-formed address', async () => {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'joanna@example.com' })
        .expect(202);

      expect(requestPasswordReset).toHaveBeenCalledWith('joanna@example.com');
    });

    it('should reject a value that is not an email address', async () => {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'not-an-address' })
        .expect(400);

      expect(requestPasswordReset).not.toHaveBeenCalled();
    });

    it('should reject a password smuggled alongside the address', async () => {
      // ForgotPasswordDto has no password field. Without forbidNonWhitelisted
      // the property would be stripped quietly, which reads as if a caller
      // could set a password by asking for a reset.
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'joanna@example.com', password: 'chosen-by-the-caller' })
        .expect(400);

      expect(requestPasswordReset).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/reset-password', () => {
    it('should accept a token and a long enough password', async () => {
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'the-reset-token', password: 'correct-horse' })
        .expect(200);

      expect(resetPassword).toHaveBeenCalledWith('the-reset-token', 'correct-horse');
    });

    it('should reject a missing token', async () => {
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ password: 'correct-horse' })
        .expect(400);

      expect(resetPassword).not.toHaveBeenCalled();
    });

    it('should reject a short password before reaching the service', async () => {
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'the-reset-token', password: 'short' })
        .expect(400);

      expect(resetPassword).not.toHaveBeenCalled();
    });

    it('should reject a password longer than bcrypt reads', async () => {
      // Same bound as registration: bcrypt ignores bytes past 72, so accepting
      // more would silently discard part of the password.
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'the-reset-token', password: 'x'.repeat(73) })
        .expect(400);

      expect(resetPassword).not.toHaveBeenCalled();
    });

    it('should reject an email supplied instead of the token', async () => {
      // The token identifies the account. Letting a caller name the account
      // would make this route a way to set anyone's password.
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ email: 'joanna@example.com', password: 'correct-horse' })
        .expect(400);

      expect(resetPassword).not.toHaveBeenCalled();
    });
  });
});
