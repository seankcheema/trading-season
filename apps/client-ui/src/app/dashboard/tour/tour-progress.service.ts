import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

const DONE_KEY = 'ts.tour.done';
const STEP_KEY = 'ts.tour.step';

// Remembers the dashboard tour in localStorage: whether it was finished or skipped, and the
// step to resume at when it was left mid-way by a reload. Kept per browser, not per user,
// like the login lockout. Storage that is blocked or full is treated as empty, so the tour
// then simply shows again.
@Injectable({ providedIn: 'root' })
export class TourProgressService {
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  isDone(): boolean {
    return this.read(DONE_KEY) === '1';
  }

  // The step to resume at, clamped to the steps that exist; 0 when none was saved.
  savedStep(stepCount: number): number {
    const step = Math.trunc(Number(this.read(STEP_KEY)));
    return Number.isFinite(step) ? Math.min(Math.max(step, 0), stepCount - 1) : 0;
  }

  saveStep(step: number): void {
    this.write(STEP_KEY, String(step));
  }

  // Finished or skipped: the tour no longer opens by itself. It can still be started again.
  finish(): void {
    this.write(DONE_KEY, '1');
    this.remove(STEP_KEY);
  }

  private read(key: string): string | null {
    if (!this._isBrowser) {
      return null;
    }
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): void {
    if (!this._isBrowser) {
      return;
    }
    try {
      localStorage.setItem(key, value);
    } catch {
      // Not remembered; the tour shows again next time.
    }
  }

  private remove(key: string): void {
    if (!this._isBrowser) {
      return;
    }
    try {
      localStorage.removeItem(key);
    } catch {
      // Nothing to clean up when storage is unavailable.
    }
  }
}
