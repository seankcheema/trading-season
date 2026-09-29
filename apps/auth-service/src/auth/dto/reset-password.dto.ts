import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Body of POST /auth/reset-password.
 *
 * The token is the credential: it comes from the emailed link, and possession of
 * it is what authorizes the change. No current password and no access token are
 * required, because a user who has forgotten the one and lost the other is
 * exactly who this route exists for.
 */
export class ResetPasswordDto {
  /** 32 random bytes, base64url — opaque, never a JWT. */
  @IsString()
  @IsNotEmpty({ message: 'A reset token is required' })
  @MaxLength(512)
  token: string;

  /**
   * Same bounds as registration, for the same reasons: length is the rule worth
   * enforcing, and bcrypt ignores bytes past 72.
   */
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(72)
  password: string;
}
