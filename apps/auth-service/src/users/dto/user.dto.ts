export class UserDto {
  id: string;
  email: string;
  isActive: boolean;
  role: 'ADMIN' | 'TRADER';
  createdAt: Date;
  updatedAt: Date;
}
