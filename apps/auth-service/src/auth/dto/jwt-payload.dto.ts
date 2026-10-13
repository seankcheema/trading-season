import type { UserRole } from '../../users/user-role.js';

/**
 * JWT Payload structure with required claims:
 * - sub: Subject (user ID)
 * - email: User email
 * - roles: User roles (ADMIN, TRADER or ANALYST)
 * - iss: Issuer
 * - exp: Expiration time
 * - iat: Issued at time
 */
export interface JwtPayload {
  sub: string;
  email: string;
  roles: UserRole[];
  iss: string;
  exp: number;
  iat: number;
}
