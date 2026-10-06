import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  /**
   * The only login identifier. §4.2 of the BRS puts client onboarding out of
   * scope, so nothing else about the person is collected here — name, address
   * and date of birth belong to the trading service's client profile.
   */
  @ApiProperty({
    example: 'admin@example.com',
    description: 'Email address that uniquely identifies the user',
    maxLength: 254,
  })
  @IsEmail({}, { message: 'A valid email address is required' })
  @MaxLength(254) // RFC 5321 limit on a forward path
  email: string;

  /**
   * Length only. Composition rules (a digit, a symbol, mixed case) push people
   * towards predictable substitutions and shorter passwords, so length is the
   * requirement worth enforcing. The upper bound exists because bcrypt ignores
   * bytes past 72 — accepting more would silently discard them.
   */
  @ApiProperty({
    example: 'admin123',
    description: 'Password for the new account',
    minLength: 8,
    maxLength: 72,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(72)
  password: string;
}
