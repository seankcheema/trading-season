import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import {
  EMPTY,
  Observable,
  Subject,
  concat,
  finalize,
  map,
  of,
  shareReplay,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';
import { TokenStorageService } from '../core/auth/token-storage.service';
import { Timeframe } from './mock-data';

export interface MarketStock {
  symbol: string;
  companyName: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

export interface MarketSnapshot {
  sessionId: number;
  status: string;
  marketTimestamp: string;
  serverTimestamp: string;
  calendar: MarketCalendarAvailability;
  stocks: MarketStock[];
}

export interface MarketCalendarAvailability {
  timezone: string;
  firstTimestamp: string;
  lastTimestamp: string;
  tradingDates: string[];
}

export interface CandlePointDto {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandleSeries {
  rangeStart?: string;
  rangeEnd?: string;
  tradingSessions?: { start: string; end: string }[];
  sessionId: number;
  symbol: string;
  timeframe: Timeframe;
  marketTimestamp: string;
  points: CandlePointDto[];
}

export interface MarketTickEvent {
  eventId: number;
  marketTimestamp: string;
  serverTimestamp: string;
  prices: { symbol: string; price: number; sequenceNumber: number }[];
}

export interface MarketStreamHandlers {
  tick: (event: MarketTickEvent) => void;
  status: (connected: boolean) => void;
  resync: () => void;
}

@Injectable({ providedIn: 'root' })
export class MarketDataService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/market';

  readonly revision = signal(0);
  private minute = '';
  private activeSession?: number;
  private tickRevision = 0;
  private candleEpoch = 0;
  private clockRequest?: Observable<MarketSnapshot>;
  private readonly identityChanged = new Subject<void>();
  private latest?: MarketSnapshot;
  private readonly snapshotRequests = new Map<string, Observable<MarketSnapshot>>();
  private readonly invalidated = new Subject<void>();
  private readonly candlesInvalidated = new Subject<void>();
  private readonly candlesCache = new Map<string, { value: CandleSeries; expiresAt: number }>();
  private readonly candleRequests = new Map<string, Observable<CandleSeries>>();

  constructor() {
    inject(TokenStorageService).onIdentityChange(() => {
      this.identityChanged.next();
      this.clockRequest = undefined;
      this.latest = undefined;
      this.activeSession = undefined;
      this.minute = '';
      this.invalidate();
    });
  }

  invalidate(cancelSnapshots = true): void {
    this.candleEpoch++;
    if (cancelSnapshots) {
      this.invalidated.next();
      this.snapshotRequests.clear();
    }
    this.candlesInvalidated.next();
    this.candleRequests.clear();
    this.candlesCache.clear();
    this.revision.update((value) => value + 1);
  }

  private remember(snapshot: MarketSnapshot): void {
    if (!snapshot.stocks) return;
    if (this.activeSession !== undefined && this.activeSession !== snapshot.sessionId)
      this.invalidate(false);
    this.activeSession = snapshot.sessionId;
    this.latest = snapshot;
    this.advance(snapshot.marketTimestamp);
  }

  private advance(timestamp: string): void {
    const minute = timestamp.slice(0, 16);
    if (minute !== this.minute) {
      this.minute = minute;
      this.revision.update((value) => value + 1);
    }
  }

  snapshot(sessionId?: number): Observable<MarketSnapshot> {
    if (this.clockRequest) {
      return this.clockRequest.pipe(switchMap(() => this.snapshot(sessionId)));
    }
    const params =
      sessionId === undefined ? undefined : new HttpParams().set('sessionId', sessionId);
    const key = sessionId === undefined ? 'latest' : String(sessionId);
    let pending = this.snapshotRequests.get(key);
    if (!pending) {
      const tickRevision = this.tickRevision;
      const request = this.http.get<MarketSnapshot>(`${this.baseUrl}/snapshot`, { params }).pipe(
        map((snapshot) => tickRevision === this.tickRevision ? snapshot : this.reconcileSnapshot(snapshot)),
        tap((snapshot) => this.remember(snapshot)),
        takeUntil(this.invalidated),
        finalize(() => {
          if (this.snapshotRequests.get(key) === request) this.snapshotRequests.delete(key);
        }),
        shareReplay({ bufferSize: 1, refCount: true }),
      );
      this.snapshotRequests.set(key, request);
      pending = request;
    }
    const cached =
      this.latest && (sessionId === undefined || sessionId === this.latest.sessionId)
        ? this.latest
        : undefined;
    return cached ? concat(of(cached), pending) : pending;
  }

  candles(sessionId: number, symbol: string, timeframe: Timeframe): Observable<CandleSeries> {
    // Wait for the seek to finish before requesting history for its new cursor.
    if (this.clockRequest) {
      return this.clockRequest.pipe(switchMap(() => this.candles(sessionId, symbol, timeframe)));
    }
    symbol = symbol.trim().toUpperCase();
    const key = `${sessionId}:${symbol}:${timeframe}:${this.minute}`;
    const cached = this.candlesCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return of(cached.value);
    const prefix = `${sessionId}:${symbol}:${timeframe}:`;
    const retained = cached ?? [...this.candlesCache.entries()].reverse()
      .find(([entryKey]) => entryKey.startsWith(prefix))?.[1];
    const existing = this.candleRequests.get(key);
    if (existing) return retained ? concat(of(retained.value), existing) : existing;
    const epoch = this.candleEpoch;
    const params = new HttpParams()
      .set('sessionId', sessionId)
      .set('symbol', symbol)
      .set('timeframe', timeframe);
    const request = this.http.get<CandleSeries>(`${this.baseUrl}/candles`, { params }).pipe(
      switchMap((series) => {
        // Live minute changes do not invalidate a valid history response.
        if (epoch !== this.candleEpoch) return EMPTY;
        this.candlesCache.delete(key);
        this.candlesCache.set(key, { value: series, expiresAt: Date.now() + 60_000 });
        while (this.candlesCache.size > 64)
          this.candlesCache.delete(this.candlesCache.keys().next().value!);
        return of(series);
      }),
      takeUntil(this.candlesInvalidated),
      finalize(() => {
        if (this.candleRequests.get(key) === request) this.candleRequests.delete(key);
      }),
      // An effect that re-runs unsubscribes before it resubscribes. Counting references here
      // would abort the in-flight request and send an identical one; letting it finish
      // keeps one request per key and still fills the cache. Invalidation cancels it above.
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.candleRequests.set(key, request);
    return retained ? concat(of(retained.value), request) : request;
  }

  setClock(sessionId: number, timestamp: string): Observable<MarketSnapshot> {
    const params = new HttpParams().set('sessionId', sessionId);
    const request = this.http.put<MarketSnapshot>(`${this.baseUrl}/clock`, { timestamp }, { params }).pipe(
      takeUntil(this.identityChanged),
      tap((snapshot) => {
        this.clockRequest = undefined;
        this.invalidate();
        this.remember(snapshot);
      }),
      finalize(() => {
        if (this.clockRequest === request) {
          this.clockRequest = undefined;
          this.revision.update((value) => value + 1);
        }
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.clockRequest = request;
    this.invalidate();
    return request;
  }

  private reconcileSnapshot(snapshot: MarketSnapshot): MarketSnapshot {
    const latest = this.latest;
    if (!snapshot.stocks || !latest || latest.sessionId !== snapshot.sessionId ||
        Date.parse(latest.marketTimestamp) <= Date.parse(snapshot.marketTimestamp)) return snapshot;
    const prices = new Map(latest.stocks.map((stock) => [stock.symbol, stock]));
    return {
      ...snapshot,
      marketTimestamp: latest.marketTimestamp,
      serverTimestamp: latest.serverTimestamp,
      stocks: snapshot.stocks.map((stock) => {
        const live = prices.get(stock.symbol);
        if (!live) return stock;
        // A delayed response must not rewind a live quote or split price from change.
        const open = stock.price - stock.change;
        return {
          ...stock,
          price: live.price,
          timestamp: live.timestamp,
          change: live.price - open,
          changePercent: open ? ((live.price - open) / open) * 100 : 0,
        };
      }),
    };
  }

  private receiveTick(event: MarketTickEvent, handlers: MarketStreamHandlers): void {
    if (this.clockRequest) return;
    if (this.latest && event.marketTimestamp.slice(0, 10) !== this.latest.marketTimestamp.slice(0, 10)) {
      // The session-open baseline changes on the next trading day.
      this.invalidate();
      handlers.resync();
      return;
    }
    this.tickRevision++;
    if (this.latest) {
      const prices = new Map(event.prices.map((price) => [price.symbol, price.price]));
      this.latest = {
        ...this.latest,
        marketTimestamp: event.marketTimestamp,
        serverTimestamp: event.serverTimestamp,
        stocks: this.latest.stocks.map((stock) => {
          const price = prices.get(stock.symbol);
          if (price === undefined) return stock;
          const open = stock.price - stock.change;
          return {
            ...stock,
            price,
            timestamp: event.marketTimestamp,
            change: price - open,
            changePercent: open ? ((price - open) / open) * 100 : 0,
          };
        }),
      };
    }
    this.advance(event.marketTimestamp);
    handlers.tick(event);
  }

  connect(sessionId: number, handlers: MarketStreamHandlers): () => void {
    if (typeof EventSource === 'undefined') {
      handlers.status(false);
      return () => undefined;
    }
    const source = new EventSource(
      `${this.baseUrl}/stream?sessionId=${encodeURIComponent(sessionId)}`,
    );
    let closed = false;
    source.onopen = () => { if (!closed) handlers.status(true); };
    source.onerror = () => { if (!closed) handlers.status(false); };
    source.addEventListener('market-tick', (event) => {
      if (closed || (this.activeSession !== undefined && this.activeSession !== sessionId)) return;
      this.receiveTick(
        JSON.parse((event as MessageEvent<string>).data) as MarketTickEvent,
        handlers,
      );
    });
    source.addEventListener('resync', () => {
      if (closed) return;
      this.invalidate();
      handlers.resync();
    });
    return () => {
      closed = true;
      source.close();
    };
  }
}
