import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, switchMap } from 'rxjs';
import { BACKEND_API_URL } from '../../core/api.config';
import { PricePoint, Timeframe } from '../mock-data';

interface Valuation {
  timestamp: string;
  value: number;
}

// Scoped to the dashboard so history cannot survive a change of signed-in user.
@Injectable()
export class PortfolioHistoryService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(BACKEND_API_URL);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  private accountId: number | null = null;
  private timeframe: Timeframe = '1D';
  private readonly pendingCaptures = new Set<number>();
  readonly points = signal<PricePoint[]>([]);
  readonly status = signal<'loading' | 'ready' | 'error'>('ready');

  select(accountId: number | null, timeframe: Timeframe): void {
    this.request?.unsubscribe();
    this.accountId = accountId;
    this.timeframe = timeframe;
    this.points.set([]);
    this.refresh();
  }

  afterTrade(accountId: number): void {
    this.pendingCaptures.add(accountId);
    if (accountId === this.accountId) this.refresh();
  }

  refresh(): void {
    this.request?.unsubscribe();
    const accountId = this.accountId;
    if (accountId === null) {
      this.status.set('ready');
      return;
    }
    this.status.set('loading');
    const history = () =>
      this.http.get<Valuation[]>(`${this.api}/accounts/${accountId}/portfolio-history`, {
        params: { timeframe: this.timeframe },
      });
    const capture = this.pendingCaptures.has(accountId);
    const load = capture
      ? this.http
          .post<Valuation | null>(`${this.api}/accounts/${accountId}/portfolio-valuations`, {})
          .pipe(
            switchMap(() => {
              this.pendingCaptures.delete(accountId);
              return history();
            }),
          )
      : history();
    this.request = load.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (values) => {
        this.points.set(
          values.map((point) => ({ time: new Date(point.timestamp), value: point.value })),
        );
        this.status.set('ready');
      },
      error: () => this.status.set('error'),
    });
  }
}
