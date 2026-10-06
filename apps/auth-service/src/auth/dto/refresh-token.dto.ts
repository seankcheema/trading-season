import { ApiProperty } from '@nestjs/swagger';
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
  @ApiProperty({
    example: 'fLxv4C0Wn6W4dA0yI0a8n6vQ3Udj4xP4u7v1mQ2jX9A',
    description: 'Opaque refresh token issued by the auth service',
    maxLength: 512,
  })
  @IsString()
  @IsNotEmpty({ message: 'A refresh token is required' })
  @MaxLength(512)
  refreshToken: string;
}
