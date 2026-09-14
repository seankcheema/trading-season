import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import type { Jwks, JwksKey } from '../dto/jwks.dto.js';

// Re-exported so existing importers of these types from this module keep
// working; the definitions themselves live in dto/jwks.dto.ts.
export type { Jwks, JwksKey };

/**
 * Convert a PEM carried in an environment variable into a usable one.
 *
 * .env files, shells and docker-compose all mangle real newlines inside a
 * value, so keys are stored with literal \n escapes. Exported because
 * AuthModule needs the identical treatment when configuring JwtModule — if the
 * two ever diverge, verification works while signing fails.
 */
export function normalizePem(key: string | undefined): string {
  return (key ?? '').replace(/\\n/g, '\n');
}

/**
 * Service for managing JWT signing and verification keys.
 * Loads RSA keys from environment variables and exposes them for:
 * - Token signing (private key)
 * - Token verification (public key)
 * - JWKS endpoint (public key in JWK format)
 */
@Injectable()
export class JwtKeysService {
  private readonly logger = new Logger(JwtKeysService.name);
  private privateKeyPem: string;
  private publicKeyPem: string;
  private publicKeyObject: crypto.KeyObject;

  constructor() {
    this.privateKeyPem = process.env.JWT_PRIVATE_KEY || '';
    this.publicKeyPem = process.env.JWT_PUBLIC_KEY || '';

    if (!this.privateKeyPem || !this.publicKeyPem) {
      this.logger.error(
        'JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables are required',
      );
      throw new Error(
        'JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables must be set',
      );
    }

    try {
      // Normalize newlines (environment variables often have \n as literal string)
      const normalizedPublicKey = this.normalizeKey(this.publicKeyPem);
      
      // Convert string PEM to KeyObject for verification
      this.publicKeyObject = crypto.createPublicKey({
        key: normalizedPublicKey,
        format: 'pem',
      });
    } catch (error) {
      this.logger.error('Failed to load JWT public key:', error);
      throw error;
    }
  }

  /**
   * Get private key for signing tokens
   */
  getPrivateKey(): string {
    return this.normalizeKey(this.privateKeyPem);
  }

  /**
   * Get public key object for verification
   */
  getPublicKeyObject(): crypto.KeyObject {
    return this.publicKeyObject;
  }

  /**
   * Get public key as PEM string
   */
  getPublicKeyPem(): string {
    return this.publicKeyObject.export({ format: 'pem', type: 'spki' }).toString();
  }

  /**
   * Get JWKS (JSON Web Key Set) format for /.well-known/jwks.json
   */
  getJwks(): Jwks {
    try {
      const jwk = this.publicKeyToJwk();
      return {
        keys: [jwk],
      };
    } catch (error) {
      this.logger.error('Failed to generate JWKS:', error);
      throw error;
    }
  }

  /**
   * Convert the public key to JWK form (RFC 7517).
   *
   * Node exports {kty, n, e} directly from a public KeyObject; there is no
   * need to hand-parse DER. The previous implementation did, and its branch
   * guards tested `'n' in this` against the service instance, which never has
   * such a property — so the second branch was unreachable, the loop could
   * never return, and every call threw.
   */
  private publicKeyToJwk(): JwksKey {
    const { kty, n, e } = this.publicKeyObject.export({ format: 'jwk' }) as {
      kty?: string;
      n?: string;
      e?: string;
    };

    if (kty !== 'RSA' || !n || !e) {
      throw new Error('Signing key must be an RSA key');
    }

    return {
      kty,
      use: 'sig',
      alg: 'RS256',
      kid: this.generateKeyId(),
      n,
      e,
    };
  }


  /**
   * Generate a key ID (kid) for the key
   */
  private generateKeyId(): string {
    // Use hash of public key as kid
    const publicKeyPem = this.getPublicKeyPem();
    return crypto
      .createHash('sha256')
      .update(publicKeyPem)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Normalize PEM key format (handle both literal \n and actual newlines).
   * Delegates to the exported helper so AuthModule can apply the same rule.
   */
  private normalizeKey(key: string): string {
    return normalizePem(key);
  }
}
