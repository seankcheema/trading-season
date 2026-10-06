import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

/**
 * Liveness endpoint.
 *
 * Deliberately has no dependencies. It answers 200 as long as the process is up
 * and serving HTTP, which is what container orchestration needs in order to
 * decide whether the service started. Making it depend on the database would
 * conflate "the service is broken" with "the database is briefly unreachable".
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  @ApiOperation({
    summary: 'Health check endpoint',
    description: 'Liveness endpoint for container orchestration. Deliberately has no dependencies.',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      properties: {
        status: { type: 'string', example: 'ok' },
        service: { type: 'string', example: 'auth-service' },
        timestamp: { type: 'string', example: '2024-09-30T12:00:00.000Z' },
      },
    },
  })
  @Get()
  @HttpCode(HttpStatus.OK)
  check(): { status: string; service: string; timestamp: string } {
    return {
      status: 'ok',
      service: 'auth-service',
      timestamp: new Date().toISOString(),
    };
  }
}
