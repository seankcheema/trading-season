import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtKeysService } from './services/jwt-keys.service.js';
import type { Jwks } from './dto/jwks.dto.js';

/**
 * Publishes this service's public signing key so other services can verify
 * tokens without ever holding the private key.
 *
 * This lives in its own controller rather than under @Controller('auth')
 * because RFC 8615 fixes the path at the origin root. Mounted beneath /auth it
 * would be served from /auth/.well-known/jwks.json, where no standard OIDC
 * client would look for it.
 *
 * Unauthenticated by design — the whole point is that anyone can fetch it.
 */
@ApiTags('well-known')
@Controller('.well-known')
export class WellKnownController {
  constructor(private readonly jwtKeysService: JwtKeysService) {}

  @ApiOperation({
    summary: 'Get public JWKS (JSON Web Key Set)',
    description: 'Publishes this service\'s public signing key so other services can verify tokens. Cached for 5 minutes. RFC 8615 standard endpoint.',
  })
  @ApiResponse({
    status: 200,
    description: 'Public JWKS retrieved successfully',
    schema: {
      properties: {
        keys: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              kty: { type: 'string' },
              use: { type: 'string' },
              kid: { type: 'string' },
              n: { type: 'string' },
              e: { type: 'string' },
              alg: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @Get('jwks.json')
  // Without this every downstream verification hits this service, making auth
  // a hard dependency in every other service's request path.
  @Header('Cache-Control', 'public, max-age=300')
  getJwks(): Jwks {
    return this.jwtKeysService.getJwks();
  }
}
