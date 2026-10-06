import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import {
  EMPTY,
  Observable,
  Subject,
  finalize,
  of,
  shareReplay,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';
import { BACKEND_API_URL } from '../../core/api.config';
import { TokenStorageService } from '../../core/auth/token-storage.service';

export interface WatchlistEntry {
  symbol: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class WatchlistStore {
  private readonly http = inject(HttpClient);
  private readonly api = `${inject(BACKEND_API_URL)}/me/watchlist`;
  private readonly cancelled = new Subject<void>();
  private revision = 0;
  private request?: Observable<WatchlistEntry[]>;
  readonly entries = signal<WatchlistEntry[]>([]);
  readonly pending = signal(new Set<string>());
  readonly status = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly error = signal('');

  constructor() {
    inject(TokenStorageService).onIdentityChange(() => {
      this.revision++;
      this.cancelled.next();
      this.request = undefined;
      this.entries.set([]);
      this.pending.set(new Set());
      this.status.set('idle');
      this.error.set('');
    });
  }

  has(symbol: string): boolean {
    return this.entries().some((entry) => entry.symbol === symbol.toUpperCase());
  }

  load(refresh = false): Observable<WatchlistEntry[]> {
    if (this.request) return this.request;
    if (!refresh && this.status() === 'ready') return of(this.entries());
    // A GET during an optimistic write could erase the optimistic state.
    if (this.pending().size) return of(this.entries());
    const revision = this.revision;
    if (this.status() === 'idle') this.status.set('loading');
    const request = this.http.get<WatchlistEntry[]>(this.api).pipe(
      switchMap((entries) => (revision === this.revision ? of(entries) : this.load(true))),
      tap({
        next: (entries) => {
          this.entries.set(entries);
          this.status.set('ready');
          this.error.set('');
        },
        error: () => {
          this.status.set('error');
          this.error.set('Unable to refresh watchlist.');
        },
      }),
      takeUntil(this.cancelled),
      finalize(() => {
        if (this.request === request) this.request = undefined;
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.request = request;
    return request;
  }

  toggle(rawSymbol: string): Observable<unknown> {
    const symbol = rawSymbol.trim().toUpperCase();
    if (this.pending().has(symbol) || this.status() === 'idle' || this.status() === 'loading')
      return EMPTY;
    const previous = this.entries().find((entry) => entry.symbol === symbol);
    const position = this.entries().findIndex((entry) => entry.symbol === symbol);
    this.revision++;
    this.request = undefined;
    this.error.set('');
    this.pending.update((pending) => new Set(pending).add(symbol));
    this.entries.update((entries) =>
      previous
        ? entries.filter((entry) => entry.symbol !== symbol)
        : [...entries, { symbol, createdAt: new Date().toISOString() }],
    );
    const mutation: Observable<WatchlistEntry | void> = previous
      ? this.http.delete<void>(`${this.api}/${encodeURIComponent(symbol)}`)
      : this.http.put<WatchlistEntry>(`${this.api}/${encodeURIComponent(symbol)}`, {});
    return mutation.pipe(
      tap({
        next: (entry) => {
          if (entry)
            this.entries.update((entries) =>
              entries.map((item) => (item.symbol === symbol ? entry : item)),
            );
          this.status.set('ready');
        },
        error: () => {
          this.entries.update((entries) => {
            const restored = entries.filter((entry) => entry.symbol !== symbol);
            if (previous) restored.splice(position, 0, previous);
            return restored;
          });
          this.error.set('Unable to save watchlist. Click the star to retry.');
        },
      }),
      takeUntil(this.cancelled),
      finalize(() =>
        this.pending.update((pending) => {
          const next = new Set(pending);
          next.delete(symbol);
          return next;
        }),
      ),
    );
  }
}
