import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createPublicKey, generateKeyPairSync } from 'crypto';
import { JwtKeysService, normalizePem } from './jwt-keys.service.js';

/**
 * Covers key loading and the failure paths the JWKS round-trip test cannot
 * reach: missing or unreadable keys must stop the service from starting, and a
 * non-RSA key must never be published as an RS256 signing key.
 */
describe('JwtKeysService', () => {
  const originalPrivate = process.env.JWT_PRIVATE_KEY;
  const originalPublic = process.env.JWT_PUBLIC_KEY;

  // Ephemeral keys, generated per run.
  const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const rsaPrivatePem = rsa.privateKey
    .export({ type: 'pkcs8', format: 'pem' })
    .toString();
  const rsaPublicPem = rsa.publicKey
    .export({ type: 'spki', format: 'pem' })
    .toString();

  // The form keys take in .env files: real newlines replaced by literal \n.
  const escape = (pem: string) => pem.replace(/\n/g, '\\n');

  beforeEach(() => {
    process.env.JWT_PRIVATE_KEY = escape(rsaPrivatePem);
    process.env.JWT_PUBLIC_KEY = escape(rsaPublicPem);
  });

  afterEach(() => {
    process.env.JWT_PRIVATE_KEY = originalPrivate;
    process.env.JWT_PUBLIC_KEY = originalPublic;
  });

  describe('normalizePem', () => {
    it('should turn literal \\n escapes into newlines', () => {
      expect(normalizePem('a\\nb\\nc')).toBe('a\nb\nc');
    });

    it('should treat an undefined key as empty', () => {
      expect(normalizePem(undefined)).toBe('');
    });
  });

  describe('constructor', () => {
    it('should refuse to start without a private key', () => {
      delete process.env.JWT_PRIVATE_KEY;

      expect(() => new JwtKeysService()).toThrow(
        'JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables must be set',
      );
    });

    it('should refuse to start without a public key', () => {
      process.env.JWT_PUBLIC_KEY = '';

      expect(() => new JwtKeysService()).toThrow(
        'JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables must be set',
      );
    });

    it('should refuse to start with an unreadable public key', () => {
      process.env.JWT_PUBLIC_KEY = 'not a pem';

      expect(() => new JwtKeysService()).toThrow();
    });
  });

  describe('key accessors', () => {
    it('should return the private key with newlines restored', () => {
      const service = new JwtKeysService();

      expect(service.getPrivateKey()).toBe(rsaPrivatePem);
    });

    it('should expose the public key as a KeyObject and as SPKI PEM', () => {
      const service = new JwtKeysService();

      expect(service.getPublicKeyObject().asymmetricKeyType).toBe('rsa');
      expect(service.getPublicKeyPem()).toBe(rsaPublicPem);
    });
  });

  describe('getJwks', () => {
    it('should derive a stable key id from the public key', () => {
      const first = new JwtKeysService().getJwks().keys[0];
      const second = new JwtKeysService().getJwks().keys[0];

      expect(first.kid).toMatch(/^[0-9a-f]{16}$/);
      expect(second.kid).toBe(first.kid);
    });

    it('should publish a JWK that reconstructs the same public key', () => {
      const [jwk] = new JwtKeysService().getJwks().keys;

      const rebuilt = createPublicKey({ key: jwk, format: 'jwk' })
        .export({ type: 'spki', format: 'pem' })
        .toString();
      expect(rebuilt).toBe(rsaPublicPem);
    });

    it('should refuse to publish a key that is not RSA', () => {
      const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' });
      process.env.JWT_PUBLIC_KEY = ec.publicKey
        .export({ type: 'spki', format: 'pem' })
        .toString();

      const service = new JwtKeysService();

      expect(() => service.getJwks()).toThrow('Signing key must be an RSA key');
    });
  });
});
