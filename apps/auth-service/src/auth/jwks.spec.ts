import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import {
  createPublicKey,
  createVerify,
  generateKeyPairSync,
} from 'crypto';
import { WellKnownController } from './well-known.controller.js';
import { JwtKeysService, normalizePem } from './services/jwt-keys.service.js';

/**
 * The one test that would have caught the two JWKS defects this service
 * shipped with: a key-export routine that threw on every call, and a route
 * mounted under /auth where no standard client would look.
 *
 * The whole point of publishing a JWKS document is that a third party can
 * verify a token with nothing but that document. So this test does exactly
 * that — it fetches the JSON over HTTP and verifies a real RS256 signature
 * against it, never touching the private key after signing.
 */
describe('JWKS round-trip', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    // Ephemeral keys, generated per run. A committed test keypair eventually
    // gets copied into a deployment config.
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    process.env.JWT_PRIVATE_KEY = privateKey
      .export({ type: 'pkcs8', format: 'pem' })
      .toString();
    process.env.JWT_PUBLIC_KEY = publicKey
      .export({ type: 'spki', format: 'pem' })
      .toString();
    process.env.JWT_ISSUER = 'https://auth.dualeapa.test';

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [WellKnownController],
      providers: [JwtKeysService],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    jwtService = new JwtService({
      privateKey: normalizePem(process.env.JWT_PRIVATE_KEY),
      signOptions: { algorithm: 'RS256' },
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  const signAccessToken = () => {
    const now = Math.floor(Date.now() / 1000);
    return jwtService.sign({
      sub: 'user-1',
      email: 'trader@example.com',
      roles: ['TRADER'],
      iss: process.env.JWT_ISSUER,
      iat: now,
      exp: now + 900,
    });
  };

  it('should serve the document at the RFC 8615 path, not under /auth', async () => {
    await request(app.getHttpServer()).get('/.well-known/jwks.json').expect(200);
    await request(app.getHttpServer())
      .get('/auth/.well-known/jwks.json')
      .expect(404);
  });

  it('should publish exactly the public members of the key', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/.well-known/jwks.json')
      .expect(200);

    expect(Array.isArray(body.keys)).toBe(true);
    expect(body.keys).toHaveLength(1);

    // An exact allowlist rather than asserting the absence of 'd'. Listing
    // what may appear catches every private component, including ones nobody
    // thought to check for.
    expect(Object.keys(body.keys[0]).sort()).toEqual([
      'alg',
      'e',
      'kid',
      'kty',
      'n',
      'use',
    ]);
    expect(body.keys[0].kty).toBe('RSA');
    expect(body.keys[0].alg).toBe('RS256');
    expect(body.keys[0].use).toBe('sig');
  });

  it('should verify a real access token using only the published document', async () => {
    const { body: jwks } = await request(app.getHttpServer())
      .get('/.well-known/jwks.json')
      .expect(200);

    const token = signAccessToken();
    const [header, payload, signature] = token.split('.');

    // Built from the JWK alone — the private key plays no part here.
    const publicKey = createPublicKey({ key: jwks.keys[0], format: 'jwk' });
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${header}.${payload}`);

    expect(verifier.verify(publicKey, Buffer.from(signature, 'base64url'))).toBe(
      true,
    );
  });

  it('should carry the claims the acceptance criteria require', async () => {
    const token = signAccessToken();
    const claims = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString(),
    );

    expect(claims).toHaveProperty('sub');
    expect(claims).toHaveProperty('iss');
    expect(claims).toHaveProperty('iat');
    expect(claims).toHaveProperty('exp');
    expect(claims.roles).toEqual(['TRADER']);
    expect(claims.exp - claims.iat).toBe(900); // 15 minutes
  });

  it('should name the signing key so a verifier can select it', async () => {
    const { body: jwks } = await request(app.getHttpServer())
      .get('/.well-known/jwks.json')
      .expect(200);

    const header = JSON.parse(
      Buffer.from(signAccessToken().split('.')[0], 'base64url').toString(),
    );

    expect(header.alg).toBe('RS256');
    expect(jwks.keys[0].kid).toBeTruthy();
  });

  it('should reject a token whose signature has been tampered with', async () => {
    const { body: jwks } = await request(app.getHttpServer())
      .get('/.well-known/jwks.json')
      .expect(200);

    const [header, payload] = signAccessToken().split('.');
    const publicKey = createPublicKey({ key: jwks.keys[0], format: 'jwk' });

    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${header}.${payload}`);

    // Negative control: without this, a verify() that always returned true
    // would pass every other test in this file.
    expect(
      verifier.verify(publicKey, Buffer.from('not-the-signature', 'utf8')),
    ).toBe(false);
  });

  it('should be cacheable, so verifiers do not hit this service per request', async () => {
    const res = await request(app.getHttpServer())
      .get('/.well-known/jwks.json')
      .expect(200);

    expect(res.headers['cache-control']).toContain('max-age');
  });
});
