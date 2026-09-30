import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createPublicKey, createVerify, generateKeyPairSync } from 'crypto';
import { AuthService } from './auth.service.js';
import { buildJwtOptions } from './auth.module.js';
import { UsersService } from '../users/users.service.js';
import { RefreshTokensService } from '../refresh-tokens/refresh-tokens.service.js';

/**
 * Signs through the service's real signing configuration.
 *
 * Every other spec in this suite either mocks `sign()` or constructs its own
 * JwtService with options it chose itself. Both skip the one thing that can
 * actually be wrong — the configuration the running service is assembled from.
 * The module set `expiresIn` and `issuer` in signOptions while issueTokens set
 * `exp` and `iss` as claims; @nestjs/jwt merges module options into every
 * sign() call, and jsonwebtoken rejects a duplicated claim outright. Login and
 * register were a 500 on every request, and 62 tests passed.
 *
 * So this file mocks the database and nothing else.
 */
describe('token issuance through the real signing configuration', () => {
  let service: AuthService;
  let publicPem: string;

  beforeAll(() => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    // Ephemeral, per run. A committed test keypair ends up in a deployment.
    process.env.JWT_PRIVATE_KEY = privateKey
      .export({ type: 'pkcs8', format: 'pem' })
      .toString();
    publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    process.env.JWT_PUBLIC_KEY = publicPem;
    process.env.JWT_ISSUER = 'https://auth.dualeapa.test';
  });

  beforeEach(async () => {
    const user = {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'joanna@example.com',
      password: 'hashed',
      role: 'TRADER' as const,
      // validateUser still gates on this; commit 4 removes the field.
      isActive: true,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          // The real thing, built from the same factory the module uses.
          provide: JwtService,
          useValue: new JwtService(buildJwtOptions()),
        },
        {
          provide: UsersService,
          useValue: {
            findByEmail: async () => user,
            validatePassword: async () => true,
            resetFailedAttempts: async () => undefined,
            incrementFailedAttempts: async () => undefined,
            lockAccount: async () => undefined,
            isAccountLocked: () => false,
          },
        },
        {
          provide: RefreshTokensService,
          useValue: { issue: async () => 'opaque-refresh-token' },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should return a real signed access token from login', async () => {
    const result = await service.login('joanna@example.com', 'correct-horse');

    // Three segments, not a mock string. Before the fix this call threw.
    expect(result.accessToken.split('.')).toHaveLength(3);
    expect(result.refreshToken).toBe('opaque-refresh-token');
    expect(result.expiresIn).toBe(900);
  });

  it('should sign a token that verifies against the public key', async () => {
    const { accessToken } = await service.login(
      'joanna@example.com',
      'correct-horse',
    );
    const [header, payload, signature] = accessToken.split('.');

    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${header}.${payload}`);

    expect(
      verifier.verify(
        createPublicKey(publicPem),
        Buffer.from(signature, 'base64url'),
      ),
    ).toBe(true);
  });

  it('should carry the claims the backend needs, each exactly once', async () => {
    const { accessToken } = await service.login(
      'joanna@example.com',
      'correct-horse',
    );
    const claims = JSON.parse(
      Buffer.from(accessToken.split('.')[1], 'base64url').toString(),
    );

    expect(claims.sub).toBe('11111111-1111-1111-1111-111111111111');
    expect(claims.email).toBe('joanna@example.com');
    expect(claims.roles).toEqual(['TRADER']);
    expect(claims.iss).toBe('https://auth.dualeapa.test');
    expect(claims.exp - claims.iat).toBe(900);
  });

  it('should reject signOptions that duplicate a payload claim', () => {
    const options = buildJwtOptions();
    const signOptions = (options.signOptions ?? {}) as Record<string, unknown>;

    // The guard proper. issueTokens owns exp and iss; anything setting them
    // here too reaches jsonwebtoken as a duplicate and every login becomes a
    // 500. Asserting on the configuration catches it even if someone later
    // changes the payload rather than the options.
    expect(signOptions.expiresIn).toBeUndefined();
    expect(signOptions.issuer).toBeUndefined();
    expect(signOptions.algorithm).toBe('RS256');
  });
});
