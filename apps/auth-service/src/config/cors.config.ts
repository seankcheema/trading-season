import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/** Angular's dev server, which is where this is called from during development. */
export const DEFAULT_CORS_ORIGIN = 'http://localhost:4200';

/**
 * Cross-origin policy for the browser-facing routes.
 *
 * Exported and testable rather than declared inline in bootstrap: the origin
 * list is parsed from an environment variable, and parsing is the part that
 * can be wrong.
 *
 * Browsers, not servers, enforce CORS — so with no policy at all every call
 * from the Angular app is rejected before it reaches a route, and the only
 * symptom is a generic network error with nothing in this service's logs.
 */
function parseOrigins(raw: string | undefined): string[] | null {
  const parsed = (raw ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : null;
}

export function buildCorsOptions(
  origins = process.env.CORS_ORIGINS,
): CorsOptions {
  return {
    // An explicit list rather than `origin: true`. Reflecting whatever Origin
    // arrives accepts every site on the internet, and these routes hand out
    // credentials.
    // A blank or whitespace-only CORS_ORIGINS falls back to the default
    // rather than parsing to an empty allowlist. `??` alone would not: it
    // treats '' as a value, and an empty list rejects every origin — the same
    // outcome as no policy at all, but with configuration that looks present.
    origin: parseOrigins(origins) ?? [DEFAULT_CORS_ORIGIN],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // The token travels in a header, not a cookie. Turning this on would also
    // rule out any wildcard origin, so it stays off until something needs it.
    credentials: false,
    maxAge: 86400,
  };
}
