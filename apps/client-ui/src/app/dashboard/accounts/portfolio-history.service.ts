import { ChartTimeDomain } from '../shared/portfolio-axis';
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
import { TokenStorageService } from '../../core/auth/token-storage.service';

export interface SimulationPortfolio {
  accountId: number;
  at: number;
  sessionId: number;
  rangeSymbol?: string;
  quoteSymbols?: readonly string[];
  current: readonly AccountHolding[];
  orders: readonly OrderResult[];
  catalogue: readonly InstrumentRef[];
}

interface Valuation {
  timestamp: string;
  value: number;
}

@Injectable({ providedIn: 'root' })
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
  private readonly cache = new Map<string, {
    signature: string; points: PricePoint[]; domain: ChartTimeDomain | null; expiresAt: number;
  }>();
  private pendingSignature?: string;
  readonly points = signal<PricePoint[]>([]);
  readonly domain = signal<ChartTimeDomain | null>(null);
  readonly refreshing = signal(false);
  readonly displayedTimeframe = signal<Timeframe>('1D');
  readonly status = signal<'loading' | 'ready' | 'error'>('ready');

  constructor() {
    inject(TokenStorageService).onIdentityChange(() => {
      this.request?.unsubscribe();
      this.pendingSignature = undefined;
      this.cache.clear();
      this.pendingCaptures.clear();
      this.accountId = null;
      this.simulation = undefined;
      this.points.set([]);
      this.domain.set(null);
      this.refreshing.set(false);
      this.status.set('ready');
    });
  }

  private cacheKey(): string {
    return `${this.accountId}:${this.simulation?.sessionId ?? 'account'}:${this.timeframe}`;
  }

  private signature(): string {
    const context = this.simulation;
    return JSON.stringify([this.cacheKey(), context && {
      ...context, at: Math.floor(context.at / 60_000),
    }, this.market.revision()]);
  }

  private remember(): void {
    this.cache.set(this.cacheKey(), {
      signature: this.signature(), points: this.points(), domain: this.domain(),
      expiresAt: Date.now() + 60_000,
    });
    if (this.cache.size > 64) this.cache.delete(this.cache.keys().next().value!);
    this.pendingSignature = undefined;
  }

  select(accountId: number | null, timeframe: Timeframe, simulation?: SimulationPortfolio): void {
    if (accountId !== this.accountId || simulation?.sessionId !== this.simulation?.sessionId) {
      this.domain.set(null);
      this.points.set([]);
    }
    this.simulation = simulation;
    this.accountId = accountId;
    this.timeframe = timeframe;
    const signature = this.signature();
    if (this.pendingSignature === signature) return;
    const cached = this.cache.get(this.cacheKey());
    if (cached?.signature === signature && !this.pendingCaptures.has(accountId ?? -1)) {
      this.points.set(cached.points);
      this.domain.set(cached.domain);
      this.displayedTimeframe.set(timeframe);
      this.status.set('ready');
      if (cached.expiresAt > Date.now()) {
        this.request?.unsubscribe();
        this.pendingSignature = undefined;
        this.refreshing.set(false);
        return;
      }
    }
    this.refresh();
  }

  afterTrade(accountId: number): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${accountId}:`)) this.cache.delete(key);
    }
    this.pendingCaptures.add(accountId);
    if (accountId === this.accountId) this.refresh();
  }

  refresh(): void {
    this.request?.unsubscribe();
    this.pendingSignature = undefined;
    const accountId = this.accountId;
    if (accountId === null) {
      this.refreshing.set(false);
      this.status.set('ready');
      return;
    }
    this.pendingSignature = this.signature();
    this.refreshing.set(true);
    if (!this.points().length && !this.cache.has(this.cacheKey())) this.status.set('loading');
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
        this.displayedTimeframe.set(this.timeframe);
        this.remember();
        this.refreshing.set(false);
        this.status.set('ready');
      },
      error: () => {
        this.pendingSignature = undefined;
        const cached = this.cache.get(this.cacheKey());
        if (cached) cached.expiresAt = 0;
        this.refreshing.set(false);
        this.status.set('error');
      },
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
    if (context.rangeSymbol) symbols.add(context.rangeSymbol);
    const requests = [...symbols]
      .filter((symbol) => !context.quoteSymbols?.length || context.quoteSymbols.includes(symbol))
      .map((symbol) => this.market.candles(context.sessionId, symbol, this.timeframe));
    this.request = (requests.length ? forkJoin(requests) : of([]))
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((series) => {
          const days = { '1D': 1, '5D': 7, '1M': 31, '1Y': 366 }[this.timeframe];
          const metadata = series.find((item) => item.rangeStart && item.rangeEnd);
          const start = metadata
            ? Date.parse(metadata.rangeStart!)
            : context.at - days * 86_400_000;
          const end = metadata ? Date.parse(metadata.rangeEnd!) : context.at;
          const sessions =
            this.timeframe === '5D'
              ? metadata?.tradingSessions?.map((item) => ({
                  start: Date.parse(item.start),
                  end: Date.parse(item.end),
                }))
              : undefined;
          this.domain.set({ start, end, sessions });
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
              return {
                time: new Date(time),
                value,
                transition: trades.some((order) => executionTime(order) === time),
              };
            });
        }),
      )
      .subscribe({
        next: (points) => {
          this.points.set(points);
          this.pendingCaptures.delete(context.accountId);
          this.displayedTimeframe.set(this.timeframe);
          this.remember();
          this.refreshing.set(false);
          this.status.set('ready');
        },
        error: () => {
          this.pendingSignature = undefined;
          const cached = this.cache.get(this.cacheKey());
          if (cached) cached.expiresAt = 0;
          this.refreshing.set(false);
          this.status.set('error');
        },
      });
  }
}
