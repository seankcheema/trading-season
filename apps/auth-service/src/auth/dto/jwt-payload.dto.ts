/**
 * JWT Payload structure with required claims:
 * - sub: Subject (user ID)
 * - email: User email
 * - roles: User roles (ADMIN or TRADER)
 * - iss: Issuer
 * - exp: Expiration time
 * - iat: Issued at time
 */
export interface JwtPayload {
  sub: string;
  email: string;
  roles: Array<'ADMIN' | 'TRADER'>;
  iss: string;
  exp: number;
  iat: number;
}
