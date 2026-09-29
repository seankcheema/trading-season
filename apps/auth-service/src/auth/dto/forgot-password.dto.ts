import { IsEmail, MaxLength } from 'class-validator';

/**
 * Body of POST /auth/forgot-password.
 *
 * Email only. The route answers the same way whether or not an account exists,
 * so there is nothing else for a caller to supply.
 */
export class ForgotPasswordDto {
  @IsEmail({}, { message: 'A valid email address is required' })
  @MaxLength(254) // RFC 5321 limit on a forward path
  email: string;
}
