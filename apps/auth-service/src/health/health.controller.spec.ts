import { describe, it, expect } from 'vitest';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('should report the service as up with the current time', () => {
    const before = Date.now();
    const result = new HealthController().check();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('auth-service');
    expect(Date.parse(result.timestamp)).toBeGreaterThanOrEqual(before);
  });
});
