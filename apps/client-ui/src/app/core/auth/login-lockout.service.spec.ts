import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LoginLockoutService } from './login-lockout.service';

const MINUTE = 60_000;
const STORAGE_KEY = 'ts.auth.loginLockout';

describe('LoginLockoutService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    localStorage.clear();
  });

  function createService(): LoginLockoutService {
    return TestBed.inject(LoginLockoutService);
  }

  function fail(service: LoginLockoutService, times: number): void {
    for (let i = 0; i < times; i++) {
      service.recordFailure();
    }
  }

  it('starts unlocked', () => {
    const service = createService();

    expect(service.checkLocked()).toBe(false);
    expect(service.remainingMs()).toBe(0);
  });

  it('stays unlocked after two rejected sign-ins', () => {
    const service = createService();

    fail(service, 2);

    expect(service.checkLocked()).toBe(false);
  });

  it('locks for 10 minutes on the third rejected sign-in', () => {
    const service = createService();

    fail(service, 3);

    expect(service.checkLocked()).toBe(true);
    expect(service.remainingMs()).toBe(10 * MINUTE);
  });

  it('counts down while locked and unlocks once 10 minutes have passed', () => {
    const service = createService();
    fail(service, 3);

    vi.advanceTimersByTime(4 * MINUTE);
    expect(service.isLocked()).toBe(true);
    expect(service.remainingMs()).toBe(6 * MINUTE);

    vi.advanceTimersByTime(6 * MINUTE);
    expect(service.isLocked()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('gives a fresh set of attempts after the lock runs out', () => {
    const service = createService();
    fail(service, 3);
    vi.advanceTimersByTime(10 * MINUTE);

    fail(service, 2);

    expect(service.checkLocked()).toBe(false);
  });

  it('starts the count again after a successful sign-in', () => {
    const service = createService();
    fail(service, 2);

    service.recordSuccess();
    fail(service, 2);

    expect(service.checkLocked()).toBe(false);
  });

  it('keeps the lock across a reload', () => {
    fail(createService(), 3);
    vi.advanceTimersByTime(3 * MINUTE);
    TestBed.resetTestingModule();

    const reloaded = createService();

    expect(reloaded.isLocked()).toBe(true);
    expect(reloaded.remainingMs()).toBe(7 * MINUTE);
  });

  it('keeps the failure count across a reload', () => {
    fail(createService(), 2);
    TestBed.resetTestingModule();

    const reloaded = createService();
    reloaded.recordFailure();

    expect(reloaded.checkLocked()).toBe(true);
  });

  it('picks up a lock set in another tab', () => {
    const service = createService();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ failedAttempts: 0, lockedUntil: Date.now() + 5 * MINUTE }),
    );

    expect(service.checkLocked()).toBe(true);
    expect(service.remainingMs()).toBe(5 * MINUTE);
  });

  it('ignores a malformed stored value', () => {
    localStorage.setItem(STORAGE_KEY, 'not json');

    const service = createService();
    fail(service, 2);

    expect(service.checkLocked()).toBe(false);
  });

  it('does nothing when rendered on the server', () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const service = createService();

    fail(service, 3);

    expect(service.checkLocked()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
