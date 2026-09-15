import { describe, it, expect } from 'vitest';
import { buildCorsOptions, DEFAULT_CORS_ORIGIN } from './cors.config.js';

describe('CORS policy', () => {
  it('should default to the Angular dev server', () => {
    expect(buildCorsOptions(undefined).origin).toEqual([DEFAULT_CORS_ORIGIN]);
  });

  it('should accept a comma-separated list and tolerate spacing', () => {
    expect(
      buildCorsOptions('http://localhost:4200, https://app.dualeapa.com').origin,
    ).toEqual(['http://localhost:4200', 'https://app.dualeapa.com']);
  });

  it('should drop empty entries from a trailing comma', () => {
    expect(buildCorsOptions('http://localhost:4200,').origin).toEqual([
      'http://localhost:4200',
    ]);
  });

  it('should fall back to the default when the variable is blank', () => {
    // An empty CORS_ORIGINS would otherwise parse to an empty allowlist, which
    // rejects every origin — the same failure as having no policy at all, but
    // harder to spot because the configuration looks present.
    expect(buildCorsOptions('').origin).toEqual([DEFAULT_CORS_ORIGIN]);
  });

  it('should never reflect an arbitrary origin', () => {
    const { origin } = buildCorsOptions('https://app.dualeapa.com');
    // `origin: true` echoes whatever Origin header arrives, which allows every
    // site on the internet to call routes that hand out credentials.
    expect(origin).not.toBe(true);
    expect(Array.isArray(origin)).toBe(true);
  });

  it('should not allow credentials while the token travels in a header', () => {
    expect(buildCorsOptions().credentials).toBe(false);
  });

  it('should allow the headers and methods the routes actually use', () => {
    const options = buildCorsOptions();
    expect(options.allowedHeaders).toContain('Authorization');
    expect(options.allowedHeaders).toContain('Content-Type');
    expect(options.methods).toContain('POST');
    expect(options.methods).toContain('OPTIONS');
  });
});
