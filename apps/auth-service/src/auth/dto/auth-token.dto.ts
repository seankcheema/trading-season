import { ApiProperty } from '@nestjs/swagger';

export class AuthTokenDto {
  @ApiProperty({
    description: 'Short-lived JWT access token used to call protected APIs',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Opaque refresh token used to obtain a new access token',
    example: 'fLxv4C0Wn6W4dA0yI0a8n6vQ3Udj4xP4u7v1mQ2jX9A',
  })
  refreshToken: string;

  @ApiProperty({
    description: 'Access token lifetime in seconds',
    example: 900,
  })
  expiresIn: number;
}
