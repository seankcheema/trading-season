/**
 * JWKS (JSON Web Key Set) format for publishing public keys
 * See: https://tools.ietf.org/html/rfc7517
 */
export interface JwksKey {
  kty: string; // Key type (RSA)
  use: string; // Key usage (sig for signing)
  alg: string; // Algorithm (RS256)
  kid: string; // Key ID
  n: string; // RSA modulus (base64url)
  e: string; // RSA exponent (base64url)
}

export interface Jwks {
  keys: JwksKey[];
}
