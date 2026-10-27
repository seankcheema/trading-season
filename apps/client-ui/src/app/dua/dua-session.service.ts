import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router } from '@angular/router';
import { TokenStorageService } from '../core/auth/token-storage.service';
import { BACKEND_API_URL } from '../core/api.config';

export interface ReadContext {
  accountId: number;
  sessionId: number;
  insight: string;
  symbol: string;
  version: string;
}
const key = (c: ReadContext) =>
  JSON.stringify([c.accountId, c.sessionId, c.insight, c.symbol, c.version]);

@Injectable({ providedIn: 'root' })
export class DuaSession {
  readonly minimized = signal(true);
  // Whether a stock page has already opened Dua by itself during this visit.
  marketOpened = false;
  // Stocks whose forecast Dua has already pointed out, or been opened on, during this visit.
  readonly forecastSeen = new Set<string>();
  // The panel size the user has dragged to, kept for the visit across pages; null is the default.
  readonly size = signal<{ width: number; height: number } | null>(null);
  readonly revision = signal(0);
  private readonly http = inject(HttpClient);
  private readonly api = inject(BACKEND_API_URL);
  private viewed = new Set<string>();
  private pending = new Map<string, ReadContext>();
  private contexts: ReadContext[] = [];
  private generation = 0;
  private querying = false;
  private readonly destroy = inject(DestroyRef);

  unread(context: ReadContext): boolean {
    this.revision();
    return !this.viewed.has(key(context));
  }
  query(contexts: ReadContext[]): void {
    this.contexts = contexts;
    if (!contexts.length || this.querying) return;
    this.querying = true;
    const generation = this.generation;
    this.http
      .post<ReadContext[]>(`${this.api}/me/dua/read-state/query`, { contexts })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (entries) => {
          if (generation !== this.generation) return;
          // Acknowledgments are immutable; a response started before a local write cannot unread it.
          for (const entry of entries) this.viewed.add(key(entry));
          this.revision.update((n) => n + 1);
          this.querying = false;
          if (JSON.stringify(this.contexts) !== JSON.stringify(contexts)) this.query(this.contexts);
        },
        error: () => {
          if (generation === this.generation) this.querying = false;
        },
      });
  }
  viewedSummary(context: ReadContext): void {
    this.viewed.add(key(context));
    this.pending.set(key(context), context);
    this.revision.update((n) => n + 1);
    this.save(context);
  }
  private save(context: ReadContext): void {
    const generation = this.generation;
    this.http
      .put(`${this.api}/me/dua/read-state`, context)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          if (generation === this.generation) this.pending.delete(key(context));
        },
        error: () => undefined,
      });
  }
  constructor() {
    inject(Router)
      .events.pipe(takeUntilDestroyed())
      .subscribe((event) => {
        if (event instanceof NavigationStart) this.minimized.set(true);
      });
    inject(TokenStorageService).onIdentityChange(() => {
      this.generation++;
      this.querying = false;
      this.viewed.clear();
      this.pending.clear();
      this.contexts = [];
      this.minimized.set(true);
      this.revision.update((n) => n + 1);
    });
    const sync = () => {
      if (!this.minimized()) this.query(this.contexts);
      for (const context of this.pending.values()) this.save(context);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', sync);
      const timer = setInterval(sync, 60_000);
      this.destroy.onDestroy(() => {
        clearInterval(timer);
        window.removeEventListener('focus', sync);
      });
    }
  }
}
