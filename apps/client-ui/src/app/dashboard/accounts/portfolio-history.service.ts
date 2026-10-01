import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, switchMap, forkJoin, map, of } from 'rxjs';
import { BACKEND_API_URL } from '../../core/api.config';
import { MarketDataService } from '../market-data.service';
import { AccountHolding } from './account.models';
import { InstrumentRef, OrderResult } from '../orders/order.models';
import { executionTime, effectiveOrders, holdingsAt } from './simulation-account';
import { PricePoint, Timeframe } from '../mock-data';

export interface SimulationPortfolio {
  accountId: number;
  at: number;
  sessionId: number;
  current: readonly AccountHolding[];
  orders: readonly OrderResult[];
  catalogue: readonly InstrumentRef[];
}

interface Valuation {
  timestamp: string;
  value: number;
}

// Scoped to the dashboard so history cannot survive a change of signed-in user.
@Injectable()
export class PortfolioHistoryService {
  private readonly http = inject(HttpClient);
  private readonly market = inject(MarketDataService);
  private simulation?: SimulationPortfolio;
  private readonly api = inject(BACKEND_API_URL);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  private accountId: number | null = null;
  private timeframe: Timeframe = '1D';
  private readonly pendingCaptures = new Set<number>();
  readonly points = signal<PricePoint[]>([]);
  readonly status = signal<'loading' | 'ready' | 'error'>('ready');

  select(accountId: number | null, timeframe: Timeframe, simulation?: SimulationPortfolio): void {
    this.simulation = simulation;
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
    if (this.simulation) {
      this.loadSimulation(this.simulation);
      return;
    }
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
  private loadSimulation(context: SimulationPortfolio): void {
    const trades = effectiveOrders(context.orders).filter(
      (order) => order.accountId === context.accountId,
    );
    const symbols = new Set(context.current.map((holding) => holding.symbol));
    for (const order of trades) {
      const instrument = context.catalogue.find((item) => item.instrumentId === order.instrumentId);
      const symbol = instrument?.simulatedStockSymbol ?? instrument?.ticker;
      if (symbol) symbols.add(symbol);
    }
    const requests = [...symbols].map((symbol) =>
      this.market.candles(context.sessionId, symbol, this.timeframe),
    );
    this.request = (requests.length ? forkJoin(requests) : of([]))
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((series) => {
          const days = { '1D': 1, '5D': 7, '1M': 31, '1Y': 366 }[this.timeframe];
          const start = context.at - days * 86_400_000;
          const times = new Set<number>([start, context.at]);
          for (const candle of series.flatMap((item) => item.points)) {
            const time = Date.parse(candle.timestamp);
            if (time >= start && time <= context.at) times.add(time);
          }
          for (const order of trades) {
            const time = executionTime(order);
            if (time > start && time <= context.at) {
              times.add(time - 1);
              times.add(time);
            }
          }
          return [...times]
            .sort((a, b) => a - b)
            .map((time) => {
              const positions = holdingsAt(
                context.current,
                context.orders,
                context.catalogue,
                context.accountId,
                time,
              );
              const value = positions.reduce((sum, holding) => {
                const candles = series.find((item) => item.symbol === holding.symbol)?.points ?? [];
                const quote = candles.findLast((point) => Date.parse(point.timestamp) <= time);
                return sum + holding.quantity * (quote?.close ?? holding.averageCost);
              }, 0);
              return { time: new Date(time), value };
            });
        }),
      )
      .subscribe({
        next: (points) => {
          this.points.set(points);
          this.status.set('ready');
        },
        error: () => {
          this.points.set([]);
          this.status.set('error');
        },
      });
  }
}
