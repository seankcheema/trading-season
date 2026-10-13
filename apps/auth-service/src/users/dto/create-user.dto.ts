import type { UserRole } from '../user-role.js';

export class CreateUserDto {
  email: string;
  password: string;
  /**
   * Omitted for every registration, which leaves the column default of
   * TRADER. Only trusted callers inside this service set it; the public
   * register route never reads a role from the request.
   */
  role?: UserRole;
}
