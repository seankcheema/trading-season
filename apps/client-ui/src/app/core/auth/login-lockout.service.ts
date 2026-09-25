import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';

// Rejected sign-ins in a row that lock the login form, and how long the lock lasts.
export const MAX_FAILED_LOGIN_ATTEMPTS = 3;
export const LOGIN_LOCKOUT_MINUTES = 10;

const STORAGE_KEY = 'ts.auth.loginLockout';

// The countdown is shown to the second, so the lock is re-checked that often while it holds.
const TICK_MS = 1_000;

interface LockoutState {
  failedAttempts: number;
  lockedUntil: number | null;
}

// Locks the login form after MAX_FAILED_LOGIN_ATTEMPTS rejected sign-ins in a row. The count
// and lock are kept in localStorage, so they cover every tab in this browser and survive a
// reload. A successful sign-in, or the lock running out, starts the count again. This is a UI
// limit only; the auth service applies its own lockout independently.
@Injectable({ providedIn: 'root' })
export class LoginLockoutService {
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _lockedUntil = signal<number | null>(null);
  private readonly _now = signal(Date.now());
  private _timer: ReturnType<typeof setInterval> | null = null;

  // Milliseconds until sign-in is allowed again; 0 when it is not locked.
  readonly remainingMs = computed(() => {
    const lockedUntil = this._lockedUntil();
    return lockedUntil === null ? 0 : Math.max(0, lockedUntil - this._now());
  });
  readonly isLocked = computed(() => this.remainingMs() > 0);

  constructor() {
    this.sync();
  }

  // Re-reads the lock from storage first, so a lock set in another tab applies here too.
  checkLocked(): boolean {
    this.sync();
    return this.isLocked();
  }

  recordFailure(): void {
    if (!this._isBrowser) {
      return;
    }
    const failedAttempts = this.read().failedAttempts + 1;
    this.write(
      failedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS
        ? { failedAttempts: 0, lockedUntil: Date.now() + LOGIN_LOCKOUT_MINUTES * 60_000 }
        : { failedAttempts, lockedUntil: null },
    );
    this.sync();
  }

  recordSuccess(): void {
    if (!this._isBrowser) {
      return;
    }
    this.clear();
    this.sync();
  }

  private sync(): void {
    if (!this._isBrowser) {
      return;
    }
    const now = Date.now();
    const { lockedUntil } = this.read();
    this._now.set(now);
    if (lockedUntil !== null && lockedUntil > now) {
      this._lockedUntil.set(lockedUntil);
      this._timer ??= setInterval(() => this.sync(), TICK_MS);
      return;
    }
    if (lockedUntil !== null) {
      // The lock has run out, so the user gets a fresh set of attempts.
      this.clear();
    }
    this._lockedUntil.set(null);
    if (this._timer !== null) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  private read(): LockoutState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Partial<LockoutState>) : null;
      const failedAttempts = Number(parsed?.failedAttempts);
      const lockedUntil = Number(parsed?.lockedUntil);
      return {
        failedAttempts: Number.isInteger(failedAttempts) && failedAttempts > 0 ? failedAttempts : 0,
        lockedUntil: Number.isFinite(lockedUntil) && lockedUntil > 0 ? lockedUntil : null,
      };
    } catch {
      return { failedAttempts: 0, lockedUntil: null };
    }
  }

  private write(state: LockoutState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Without storage the limit cannot be kept; sign-in stays governed by the auth service.
    }
  }

  private clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clean up if storage is unavailable.
    }
  }
}
