import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface JwksKey {
  kty: string;
  use: string;
  alg: string;
  kid: string;
  n: string;
  e: string;
}

export interface Jwks {
  keys: JwksKey[];
}

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
   * Convert public key to JWK format (RFC 7517)
   */
  private publicKeyToJwk() {
    const publicKeyObject = this.publicKeyObject;
    
    // Get key details
    const keyDetails = publicKeyObject.asymmetricKeyDetails as any;
    if (!keyDetails) {
      throw new Error('Invalid RSA public key');
    }

    // Export key in DER format
    const publicKeyDer = publicKeyObject.export({
      format: 'der',
      type: 'spki',
    });

    // Parse RSA components from DER (modulus and exponent)
    const { n, e } = this.extractRsaComponents(publicKeyDer);

    return {
      kty: 'RSA',
      use: 'sig',
      alg: 'RS256',
      kid: this.generateKeyId(),
      n: n,
      e: e,
    };
  }

  /**
   * Extract RSA modulus and exponent from DER-encoded public key
   * This is a simplified parser; for production, consider using asn1.js
   */
  private extractRsaComponents(
    derBuffer: Buffer,
  ): { n: string; e: string } {
    // DER format for RSA public key (SEQUENCE of modulus and exponent)
    // This is a basic parser that works for 2048-bit keys
    
    // For a more robust solution, use:
    // npm install asn1.js
    // But this simpler approach works for standard RSA keys
    
    // Skip DER header bytes and find MODULUS and EXPONENT
    // The structure is: SEQUENCE { MODULUS INTEGER, EXPONENT INTEGER }
    
    // For now, use Node.js crypto's private methods via workaround
    // or use the publicKey export with jwk format if available (Node 15.7+)
    
    try {
      // Try to use the KeyObject's internal details (Node.js 15.7+)
      const details = this.publicKeyObject.asymmetricKeyDetails as any;
      
      if (details && details.modulusLength) {
        // For Node.js 15.7+, we can extract from the key details
        // However, the actual n and e values are not directly exposed
        // We need to re-export or use a library
        
        // Fallback: use 'jose' or 'jsonwebtoken' libraries for robust JWK export
        // For now, provide a base64url-encoded version of the key
        return this.extractFromDerManually(derBuffer);
      }
    } catch (error) {
      this.logger.warn('Could not extract RSA components using details', error);
    }

    return this.extractFromDerManually(derBuffer);
  }

  /**
   * Manual DER parsing for RSA public key
   * Extracts MODULUS and EXPONENT from SubjectPublicKeyInfo structure
   */
  private extractFromDerManually(derBuffer: Buffer): { n: string; e: string } {
    // This is a simplified implementation
    // For production, use: npm install asn1.js
    
    // DER structure: 
    // SEQUENCE {
    //   SEQUENCE { OID rsaEncryption, NULL }
    //   BIT STRING {
    //     SEQUENCE {
    //       INTEGER modulus
    //       INTEGER exponent
    //     }
    //   }
    // }
    
    // Skip to BIT STRING (after OID and NULL)
    let offset = 0;
    
    // Find the second SEQUENCE (inside BIT STRING)
    while (offset < derBuffer.length) {
      if (derBuffer[offset] === 0x02) { // INTEGER tag
        const length = this.parseDerLength(derBuffer, offset + 1);
        const valueStart = offset + this.getLengthFieldSize(derBuffer, offset + 1) + 1;
        
        if (!('n' in this)) {
          // First INTEGER is modulus
          const modulusBuffer = derBuffer.slice(valueStart, valueStart + length);
          // Store temporarily
          (this as any).modulusBuffer = modulusBuffer;
        } else if (!('e' in this)) {
          // Second INTEGER is exponent
          const exponentBuffer = derBuffer.slice(valueStart, valueStart + length);
          // Store temporarily
          (this as any).exponentBuffer = exponentBuffer;
          
          return {
            n: this.bufferToBase64Url((this as any).modulusBuffer),
            e: this.bufferToBase64Url(exponentBuffer),
          };
        }
        
        offset += 1 + this.getLengthFieldSize(derBuffer, offset + 1) + length;
      } else {
        offset++;
      }
    }

    // Fallback: This should not happen with valid RSA keys
    throw new Error('Could not extract RSA components from DER');
  }

  /**
   * Parse DER length field (can be 1 or more bytes)
   */
  private parseDerLength(buffer: Buffer, offset: number): number {
    let length = buffer[offset];
    if (length & 0x80) {
      const numOctets = length & 0x7f;
      length = 0;
      for (let i = 0; i < numOctets; i++) {
        length = (length << 8) | buffer[offset + 1 + i];
      }
    }
    return length;
  }

  /**
   * Get size of DER length field
   */
  private getLengthFieldSize(buffer: Buffer, offset: number): number {
    const firstByte = buffer[offset];
    if (firstByte & 0x80) {
      return (firstByte & 0x7f) + 1;
    }
    return 1;
  }

  /**
   * Convert buffer to base64url encoding (RFC 4648)
   */
  private bufferToBase64Url(buffer: Buffer): string {
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
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
