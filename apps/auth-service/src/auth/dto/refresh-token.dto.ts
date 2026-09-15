import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

/**
 * Body of POST /auth/refresh and POST /auth/logout.
 *
 * Both routes previously read `req.body?.refreshToken` through an `as any`
 * cast, so the two endpoints handling the long-lived credential were the only
 * ones with no declared request shape.
 */
export class RefreshTokenDto {
  /** 32 random bytes, base64url — opaque, never a JWT. */
  @IsString()
  @IsNotEmpty({ message: 'A refresh token is required' })
  @MaxLength(512)
  refreshToken: string;
}
