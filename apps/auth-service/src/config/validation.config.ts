import { ValidationPipe } from '@nestjs/common';

/**
 * The validation the service actually runs on.
 *
 * Exported from one place so tests apply the same pipe the process does. A spec
 * that configures its own is testing a policy nothing deploys — which is how a
 * module that could not sign a single token passed sixty-two tests.
 */
export function buildValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    // Until this existed the DTOs were type-only: TypeScript shaped them at
    // compile time and nothing checked them at runtime, so `{"email": 12345}`
    // was accepted and stored.
    whitelist: true,
    // Reject unknown properties rather than stripping them silently. The
    // registration form collects eleven fields and /auth/register takes two;
    // a 400 naming the extras is how a caller finds that out, instead of a 201
    // that quietly discards nine of them.
    forbidNonWhitelisted: true,
    transform: true,
  });
}
