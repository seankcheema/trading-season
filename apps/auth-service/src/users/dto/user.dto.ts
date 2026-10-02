export class UserDto {
  id: string;
  email: string;
  role: 'ADMIN' | 'TRADER';
  createdAt: Date;
  updatedAt: Date;
}
