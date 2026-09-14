import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';

/**
 * Liveness endpoint.
 *
 * Deliberately has no dependencies. It answers 200 as long as the process is up
 * and serving HTTP, which is what container orchestration needs in order to
 * decide whether the service started. Making it depend on the database would
 * conflate "the service is broken" with "the database is briefly unreachable".
 */
@Controller('health')
export class HealthController {
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
