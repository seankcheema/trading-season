export class UserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  emailVerified: boolean;
  role: 'ADMIN' | 'TRADER';
  createdAt: Date;
  updatedAt: Date;
}
