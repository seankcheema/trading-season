import { IsEmail, IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'A valid email address is required' })
  @MaxLength(254)
  email: string;

  /**
   * Deliberately not length-checked. A minimum here would reject a short
   * password before comparing it, which answers faster than a real attempt and
   * leaks that the input could not have been a stored password. Login accepts
   * anything non-empty and returns the same generic 401 either way.
   */
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MaxLength(72)
  password: string;
}
