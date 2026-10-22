import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

// Limits the settings dialog offers, in minutes.
export const IDLE_TIMEOUT_OPTIONS = [5, 10, 15, 30, 60] as const;
export const DEFAULT_IDLE_TIMEOUT_MINUTES = 10;

// Query parameter value the login page reads to explain why the user was signed out.
export const INACTIVE_SIGN_OUT_REASON = 'inactive';

const TIMEOUT_STORAGE_KEY = 'ts.settings.idleTimeoutMinutes';
const ACTIVITY_STORAGE_KEY = 'ts.auth.lastActivity';

// Persisting every mousemove would be wasteful; a few seconds of drift is irrelevant against
// a limit measured in minutes.
const ACTIVITY_WRITE_INTERVAL_MS = 5_000;

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'wheel', 'scroll', 'touchstart'];

// How long before signing out the user is warned, and how often the warning rechecks for input
// in another tab, which this tab only sees through storage.
export const IDLE_WARNING_MS = 60_000;
const WARNING_RECHECK_MS = 5_000;

// Signs the user out after a period without input, raising a warning in the last minute so Dua
// can ask whether the user is still there. The countdown only runs while a session exists. The last activity time is shared through localStorage, so input in another tab keeps
// this one alive and a reload after the limit has passed still signs the user out.
@Injectable({ providedIn: 'root' })
export class SessionTimeoutService {
  private readonly _authService = inject(AuthService);
  private readonly _router = inject(Router);
  private readonly _document = inject(DOCUMENT);
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _timeoutMinutes = signal(this.readTimeoutMinutes());
  readonly timeoutMinutes = this._timeoutMinutes.asReadonly();
  // True in the last minute before an idle sign-out; any input clears it.
  private readonly _warning = signal(false);
  readonly warning = this._warning.asReadonly();

  private _lastActivity: number | null = null;
  private _lastWrite = 0;
  private _timer: ReturnType<typeof setTimeout> | null = null;

  private readonly _onActivity = () => this.recordActivity();
  private readonly _onVisibilityChange = () => {
    if (!this._document.hidden) {
      this.check();
    }
  };

  constructor() {
    if (!this._isBrowser) {
      return;
    }
    effect(() => {
      const authenticated = this._authService.isAuthenticated();
      this._timeoutMinutes();
      untracked(() => (authenticated ? this.start() : this.stop()));
    });
  }

  setTimeoutMinutes(minutes: number): void {
    if (!isTimeoutOption(minutes)) {
      return;
    }
    this._timeoutMinutes.set(minutes);
    if (!this._isBrowser) {
      return;
    }
    try {
      localStorage.setItem(TIMEOUT_STORAGE_KEY, String(minutes));
    } catch {
      // The new limit still applies until the page is reloaded.
    }
  }

  private start(): void {
    if (this._lastActivity === null) {
      // A restored session resumes from its recorded activity; a new sign-in starts now.
      this._lastActivity = this.readStoredActivity() ?? Date.now();
      this.writeActivity(this._lastActivity);
      for (const type of ACTIVITY_EVENTS) {
        this._document.addEventListener(type, this._onActivity, { capture: true, passive: true });
      }
      this._document.addEventListener('visibilitychange', this._onVisibilityChange);
    }
    this.check();
  }

  private stop(): void {
    if (this._lastActivity === null) {
      return;
    }
    this._lastActivity = null;
    this._warning.set(false);
    this.clearTimer();
    for (const type of ACTIVITY_EVENTS) {
      this._document.removeEventListener(type, this._onActivity, { capture: true });
    }
    this._document.removeEventListener('visibilitychange', this._onVisibilityChange);
    try {
      localStorage.removeItem(ACTIVITY_STORAGE_KEY);
    } catch {
      // Nothing to clean up if storage is unavailable.
    }
  }

  private recordActivity(): void {
    if (this._lastActivity === null) {
      return;
    }
    const now = Date.now();
    this._lastActivity = now;
    if (now - this._lastWrite >= ACTIVITY_WRITE_INTERVAL_MS || this._warning()) {
      this.writeActivity(now);
    }
    if (this._warning()) {
      this.check();
    }
  }

  // Signs out if the limit has passed, otherwise sleeps until it next could have, or until the
  // warning is due. Activity only moves the deadline, so the timer is rescheduled here rather
  // than on every input event, except to end a warning.
  private check(): void {
    if (this._lastActivity === null) {
      return;
    }
    this.clearTimer();
    const lastActivity = Math.max(this._lastActivity, this.readStoredActivity() ?? 0);
    this._lastActivity = lastActivity;
    const remaining = lastActivity + this._timeoutMinutes() * 60_000 - Date.now();
    if (remaining <= 0) {
      this.signOut();
      return;
    }
    const warning = remaining <= IDLE_WARNING_MS;
    this._warning.set(warning);
    this._timer = setTimeout(
      () => this.check(),
      warning ? Math.min(remaining, WARNING_RECHECK_MS) : remaining - IDLE_WARNING_MS,
    );
  }

  private signOut(): void {
    this.stop();
    this._authService.logout().subscribe(() => {
      void this._router.navigate(['/login'], {
        queryParams: { reason: INACTIVE_SIGN_OUT_REASON },
      });
    });
  }

  private clearTimer(): void {
    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  private writeActivity(time: number): void {
    this._lastWrite = time;
    try {
      localStorage.setItem(ACTIVITY_STORAGE_KEY, String(time));
    } catch {
      // This tab still tracks activity in memory.
    }
  }

  private readStoredActivity(): number | null {
    try {
      const value = Number(localStorage.getItem(ACTIVITY_STORAGE_KEY));
      return Number.isFinite(value) && value > 0 ? value : null;
    } catch {
      return null;
    }
  }

  private readTimeoutMinutes(): number {
    if (!this._isBrowser) {
      return DEFAULT_IDLE_TIMEOUT_MINUTES;
    }
    try {
      const stored = Number(localStorage.getItem(TIMEOUT_STORAGE_KEY));
      return isTimeoutOption(stored) ? stored : DEFAULT_IDLE_TIMEOUT_MINUTES;
    } catch {
      return DEFAULT_IDLE_TIMEOUT_MINUTES;
    }
  }
}

function isTimeoutOption(minutes: number): boolean {
  return (IDLE_TIMEOUT_OPTIONS as readonly number[]).includes(minutes);
}
