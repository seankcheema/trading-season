import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
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
  stocks: MarketStock[];
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

  snapshot(sessionId?: number): Observable<MarketSnapshot> {
    const params =
      sessionId === undefined ? undefined : new HttpParams().set('sessionId', sessionId);
    return this.http.get<MarketSnapshot>(`${this.baseUrl}/snapshot`, { params });
  }

  candles(sessionId: number, symbol: string, timeframe: Timeframe): Observable<CandleSeries> {
    const params = new HttpParams()
      .set('sessionId', sessionId)
      .set('symbol', symbol)
      .set('timeframe', timeframe);
    return this.http.get<CandleSeries>(`${this.baseUrl}/candles`, { params });
  }

  setClock(sessionId: number, timestamp: string): Observable<MarketSnapshot> {
    const params = new HttpParams().set('sessionId', sessionId);
    return this.http.put<MarketSnapshot>(`${this.baseUrl}/clock`, { timestamp }, { params });
  }

  connect(sessionId: number, handlers: MarketStreamHandlers): () => void {
    if (typeof EventSource === 'undefined') {
      handlers.status(false);
      return () => undefined;
    }
    const source = new EventSource(
      `${this.baseUrl}/stream?sessionId=${encodeURIComponent(sessionId)}`,
    );
    source.onopen = () => handlers.status(true);
    source.onerror = () => handlers.status(false);
    source.addEventListener('market-tick', (event) =>
      handlers.tick(JSON.parse((event as MessageEvent<string>).data) as MarketTickEvent),
    );
    source.addEventListener('resync', () => handlers.resync());
    return () => source.close();
  }
}
