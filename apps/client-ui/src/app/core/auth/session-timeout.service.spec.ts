import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from './auth.service';
import { SessionTimeoutService } from './session-timeout.service';

const MINUTE = 60_000;
const TIMEOUT_KEY = 'ts.settings.idleTimeoutMinutes';
const ACTIVITY_KEY = 'ts.auth.lastActivity';

describe('SessionTimeoutService', () => {
  let isAuthenticated: ReturnType<typeof signal<boolean>>;
  let logout: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    isAuthenticated = signal(false);
    // Mirrors AuthService.logout, which clears the stored session before revoking it.
    logout = vi.fn(() => {
      isAuthenticated.set(false);
      return of(undefined);
    });
    navigate = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isAuthenticated, logout } },
        { provide: Router, useValue: { navigate } },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  function createService(): SessionTimeoutService {
    const service = TestBed.inject(SessionTimeoutService);
    TestBed.tick();
    return service;
  }

  function signIn(): void {
    isAuthenticated.set(true);
    TestBed.tick();
  }

  function act(type = 'mousemove'): void {
    document.dispatchEvent(new Event(type));
  }

  it('defaults to a 10 minute limit', () => {
    expect(createService().timeoutMinutes()).toBe(10);
  });

  it('does not start the countdown while signed out', () => {
    createService();

    vi.advanceTimersByTime(60 * MINUTE);

    expect(logout).not.toHaveBeenCalled();
    expect(localStorage.getItem(ACTIVITY_KEY)).toBeNull();
  });

  it('signs the user out after 10 minutes without activity', () => {
    createService();
    signIn();

    vi.advanceTimersByTime(10 * MINUTE - 1);
    expect(logout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(logout).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { reason: 'inactive' } });
  });

  it.each(['mousedown', 'mousemove', 'keydown', 'wheel', 'scroll', 'touchstart'])(
    'restarts the countdown on %s',
    (type) => {
      createService();
      signIn();

      vi.advanceTimersByTime(9 * MINUTE);
      act(type);
      vi.advanceTimersByTime(9 * MINUTE);
      expect(logout).not.toHaveBeenCalled();

      vi.advanceTimersByTime(MINUTE);
      expect(logout).toHaveBeenCalledTimes(1);
    },
  );

  it('stops counting when the user signs out manually', () => {
    createService();
    signIn();

    isAuthenticated.set(false);
    TestBed.tick();
    vi.advanceTimersByTime(60 * MINUTE);

    expect(logout).not.toHaveBeenCalled();
    expect(localStorage.getItem(ACTIVITY_KEY)).toBeNull();
  });

  it('ignores activity while signed out', () => {
    createService();
    act();

    expect(localStorage.getItem(ACTIVITY_KEY)).toBeNull();
  });

  it('starts a fresh countdown on the next sign-in after a timeout', () => {
    createService();
    signIn();
    vi.advanceTimersByTime(10 * MINUTE);
    expect(logout).toHaveBeenCalledTimes(1);

    signIn();
    vi.advanceTimersByTime(10 * MINUTE - 1);
    expect(logout).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(logout).toHaveBeenCalledTimes(2);
  });

  it('signs out a restored session that was already idle past the limit', () => {
    localStorage.setItem(ACTIVITY_KEY, String(Date.now() - 11 * MINUTE));
    isAuthenticated.set(true);

    createService();

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('resumes a restored session from its recorded activity', () => {
    localStorage.setItem(ACTIVITY_KEY, String(Date.now() - 4 * MINUTE));
    isAuthenticated.set(true);
    createService();

    vi.advanceTimersByTime(6 * MINUTE - 1);
    expect(logout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('counts activity recorded by another tab', () => {
    createService();
    signIn();

    vi.advanceTimersByTime(8 * MINUTE);
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
    vi.advanceTimersByTime(2 * MINUTE);
    expect(logout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(8 * MINUTE);
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('shares its own activity with other tabs', () => {
    createService();
    signIn();

    vi.advanceTimersByTime(MINUTE);
    act();

    expect(Number(localStorage.getItem(ACTIVITY_KEY))).toBe(Date.now());
  });

  it('checks the deadline as soon as a hidden tab becomes visible', () => {
    createService();
    signIn();
    // Browsers throttle timers in background tabs; model one that never fired.
    vi.setSystemTime(Date.now() + 11 * MINUTE);

    document.dispatchEvent(new Event('visibilitychange'));

    expect(logout).toHaveBeenCalledTimes(1);
  });

  describe('limit setting', () => {
    it('applies a new limit to the running countdown', () => {
      const service = createService();
      signIn();

      service.setTimeoutMinutes(5);
      TestBed.tick();
      vi.advanceTimersByTime(5 * MINUTE);

      expect(logout).toHaveBeenCalledTimes(1);
    });

    it('signs out immediately when the new limit has already passed', () => {
      const service = createService();
      signIn();
      vi.advanceTimersByTime(7 * MINUTE);

      service.setTimeoutMinutes(5);
      TestBed.tick();

      expect(logout).toHaveBeenCalledTimes(1);
    });

    it('extends the running countdown to a longer limit', () => {
      const service = createService();
      signIn();

      service.setTimeoutMinutes(30);
      TestBed.tick();
      vi.advanceTimersByTime(30 * MINUTE - 1);
      expect(logout).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(logout).toHaveBeenCalledTimes(1);
    });

    it('persists the limit for later visits', () => {
      createService().setTimeoutMinutes(30);

      expect(localStorage.getItem(TIMEOUT_KEY)).toBe('30');
    });

    it('reads a previously saved limit', () => {
      localStorage.setItem(TIMEOUT_KEY, '15');

      expect(createService().timeoutMinutes()).toBe(15);
    });

    it.each(['7', '0', '-5', 'abc'])('falls back to the default for a stored value of %s', (value) => {
      localStorage.setItem(TIMEOUT_KEY, value);

      expect(createService().timeoutMinutes()).toBe(10);
    });

    it('rejects limits that are not offered', () => {
      const service = createService();

      service.setTimeoutMinutes(0);
      service.setTimeoutMinutes(2.5);

      expect(service.timeoutMinutes()).toBe(10);
      expect(localStorage.getItem(TIMEOUT_KEY)).toBeNull();
    });
  });
});
