import type { UserRole } from '../user-role.js';

export class UserDto {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}
