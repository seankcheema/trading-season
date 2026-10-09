import { Signal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, catchError, map, merge, of, switchMap, timer } from 'rxjs';

// loading: the first load is in flight. error: it failed and there is nothing to show.
export type LiveState = 'loading' | 'ready' | 'error';

export interface Live<T> {
  readonly data: Signal<T | null>;
  readonly state: Signal<LiveState>;
  // Loads again now, for a retry or after the question changed.
  reload(): void;
}

// Keeps a screen's data fresh: loads at once, again every intervalMs, and on
// reload(). A refresh that fails leaves the last good data on screen. Call from
// a constructor or field initializer; it stops with its owner.
export function live<T>(load: () => Observable<T>, intervalMs: number): Live<T> {
  const data = signal<T | null>(null);
  const state = signal<LiveState>('loading');
  const reloads = new Subject<void>();

  merge(timer(0, intervalMs), reloads)
    .pipe(
      switchMap(() =>
        load().pipe(
          map((value) => ({ value })),
          catchError(() => of(null)),
        ),
      ),
      takeUntilDestroyed(),
    )
    .subscribe((result) => {
      if (result) {
        data.set(result.value);
        state.set('ready');
      } else if (data() === null) {
        state.set('error');
      }
    });

  return { data, state, reload: () => reloads.next() };
}
