import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CandleSeries, MarketDataService, MarketStreamHandlers } from './market-data.service';
import { TokenStorageService } from '../core/auth/token-storage.service';

type Listener = (event: MessageEvent<string>) => void;

/** Records what the service wires onto an EventSource so tests can drive it. */
class FakeEventSource {
  static last: FakeEventSource | null = null;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readonly listeners = new Map<string, Listener>();
  closed = false;

  constructor(readonly url: string) {
    FakeEventSource.last = this;
  }

  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, listener);
  }

  close(): void {
    this.closed = true;
  }
}

describe('MarketDataService', () => {
  let service: MarketDataService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MarketDataService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.unstubAllGlobals();
    FakeEventSource.last = null;
  });

  it('should request the latest snapshot without a session parameter', () => {
    service.snapshot().subscribe();

    const req = http.expectOne((r) => r.url === '/api/market/snapshot');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('sessionId')).toBe(false);
    req.flush({});
  });

  it('should scope a snapshot to the given session', () => {
    service.snapshot(7).subscribe();

    const req = http.expectOne((r) => r.url === '/api/market/snapshot');
    expect(req.request.params.get('sessionId')).toBe('7');
    req.flush({});
  });

  it('should request candles for the session, symbol and timeframe', () => {
    service.candles(7, 'AAPL', '5D').subscribe();

    const req = http.expectOne((r) => r.url === '/api/market/candles');
    expect(req.request.params.get('sessionId')).toBe('7');
    expect(req.request.params.get('symbol')).toBe('AAPL');
    expect(req.request.params.get('timeframe')).toBe('5D');
    req.flush({ points: [] });
  });

  it('should move the session clock with a PUT carrying the timestamp', () => {
    service.setClock(7, '2026-01-05T16:00:00Z').subscribe();

    const req = http.expectOne((r) => r.url === '/api/market/clock');
    expect(req.request.method).toBe('PUT');
    expect(req.request.params.get('sessionId')).toBe('7');
    expect(req.request.body).toEqual({ timestamp: '2026-01-05T16:00:00Z' });
    req.flush({});
  });

  describe('connect', () => {
    function handlers() {
      return {
        tick: vi.fn<MarketStreamHandlers['tick']>(),
        status: vi.fn<MarketStreamHandlers['status']>(),
        resync: vi.fn<MarketStreamHandlers['resync']>(),
      };
    }

    it('should report disconnected when the platform has no EventSource', () => {
      vi.stubGlobal('EventSource', undefined);
      const h = handlers();

      const disconnect = service.connect(7, h);

      expect(h.status).toHaveBeenCalledWith(false);
      expect(() => disconnect()).not.toThrow();
    });

    it('should forward stream events to the handlers and close on disconnect', () => {
      vi.stubGlobal('EventSource', FakeEventSource);
      const h = handlers();

      const disconnect = service.connect(7, h);
      const source = FakeEventSource.last!;

      expect(source.url).toBe('/api/market/stream?sessionId=7');

      source.onopen!();
      expect(h.status).toHaveBeenLastCalledWith(true);
      source.onerror!();
      expect(h.status).toHaveBeenLastCalledWith(false);

      const tick = { eventId: 1, marketTimestamp: 't', serverTimestamp: 's', prices: [] };
      source.listeners.get('market-tick')!({ data: JSON.stringify(tick) } as MessageEvent<string>);
      expect(h.tick).toHaveBeenCalledWith(tick);

      source.listeners.get('resync')!({} as MessageEvent<string>);
      expect(h.resync).toHaveBeenCalledOnce();

      disconnect();
      expect(source.closed).toBe(true);
      source.listeners.get('market-tick')!({ data: JSON.stringify(tick) } as MessageEvent<string>);
      source.listeners.get('resync')!({} as MessageEvent<string>);
      expect(h.tick).toHaveBeenCalledTimes(1);
      expect(h.resync).toHaveBeenCalledTimes(1);
    });
  });
  it('keeps price and change on the newest tick when snapshot revalidation finishes late', () => {
    const snapshot = {
      sessionId: 7, marketTimestamp: '2026-01-05T15:00:00Z',
      serverTimestamp: '2026-01-05T15:00:00Z',
      stocks: [{ symbol: 'AAPL', companyName: 'Apple', price: 100, change: 5,
        changePercent: (5 / 95) * 100, timestamp: '2026-01-05T15:00:00Z' }],
    };
    service.snapshot().subscribe();
    http.expectOne('/api/market/snapshot').flush(snapshot);
    vi.stubGlobal('EventSource', FakeEventSource);
    const handlers = { tick: vi.fn(), status: vi.fn(), resync: vi.fn() };
    const disconnect = service.connect(7, handlers);
    let quote = snapshot.stocks[0];
    service.snapshot().subscribe((value) => { quote = value.stocks[0]; });
    FakeEventSource.last!.listeners.get('market-tick')!({ data: JSON.stringify({
      eventId: 2, marketTimestamp: '2026-01-05T15:00:02Z',
      serverTimestamp: '2026-01-05T15:00:02Z',
      prices: [{ symbol: 'AAPL', price: 102, sequenceNumber: 2 }],
    }) } as MessageEvent<string>);
    http.expectOne('/api/market/snapshot').flush(snapshot);
    expect(quote.price).toBe(102);
    expect(quote.change).toBe(7);
    expect(quote.changePercent).toBeCloseTo((7 / 95) * 100);
    disconnect();
  });

  it('refreshes the opening baseline when the replay reaches another trading day', () => {
    service.snapshot().subscribe();
    http.expectOne('/api/market/snapshot').flush({
      sessionId: 7, marketTimestamp: '2026-01-05T21:00:00Z', stocks: [],
    });
    vi.stubGlobal('EventSource', FakeEventSource);
    const handlers = { tick: vi.fn(), status: vi.fn(), resync: vi.fn() };
    const disconnect = service.connect(7, handlers);
    FakeEventSource.last!.listeners.get('market-tick')!({ data: JSON.stringify({
      marketTimestamp: '2026-01-06T14:30:00Z', prices: [],
    }) } as MessageEvent<string>);
    expect(handlers.resync).toHaveBeenCalledOnce();
    expect(handlers.tick).not.toHaveBeenCalled();
    disconnect();
  });
  it('shares in-flight candles and reuses successful entries until expiry', () => {
    const received: unknown[] = [];
    service.candles(7, ' aapl ', '1D').subscribe((value) => received.push(value));
    service.candles(7, 'AAPL', '1D').subscribe((value) => received.push(value));
    const req = http.expectOne((request) => request.url === '/api/market/candles');
    req.flush({ points: [], symbol: 'AAPL' });
    service.candles(7, 'AAPL', '1D').subscribe((value) => received.push(value));
    http.expectNone((request) => request.url === '/api/market/candles');
    expect(received).toHaveLength(3);
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_001);
    const refreshing: unknown[] = [];
    service.candles(7, 'AAPL', '1D').subscribe((value) => refreshing.push(value));
    expect(refreshing).toHaveLength(1);
    http.expectOne((request) => request.url === '/api/market/candles').flush({ points: [] });
    expect(refreshing).toHaveLength(2);
    vi.restoreAllMocks();
  });

  it('invalidates pending candles on rewind and never publishes their old response', () => {
    service.candles(7, 'AAPL', '1D').subscribe();
    const old = http.expectOne((request) => request.url === '/api/market/candles');
    service.setClock(7, '2026-01-05T15:00:00Z').subscribe();
    expect(old.cancelled).toBe(true);
    http.expectOne((request) => request.url === '/api/market/clock').flush({});
    service.candles(7, 'AAPL', '1D').subscribe();
    http.expectOne((request) => request.url === '/api/market/candles').flush({ points: [] });
  });

  it.each([
    ['2026-01-05T14:30:00Z', '2026-01-05T17:30:00Z'],
    ['2026-01-05T17:30:00Z', '2026-01-05T14:30:00Z'],
  ])('waits for a clock jump from %s to %s before loading shared chart history', (from, to) => {
    service.snapshot().subscribe();
    http.expectOne('/api/market/snapshot').flush({ sessionId: 7, marketTimestamp: from, stocks: [] });
    service.candles(7, 'AAPL', '1D').subscribe();
    const old = http.expectOne((request) => request.url === '/api/market/candles');
    service.setClock(7, to).subscribe();
    expect(old.cancelled).toBe(true);
    const received: CandleSeries[] = [];
    service.candles(7, 'AAPL', '1D').subscribe((series) => received.push(series));
    service.candles(7, 'AAPL', '1D').subscribe((series) => received.push(series));
    service.candles(7, 'MSFT', '1D').subscribe();
    http.expectNone((request) => request.url === '/api/market/candles');
    http.expectOne((request) => request.url === '/api/market/clock')
      .flush({ sessionId: 7, marketTimestamp: to, stocks: [] });
    const points = [
      { timestamp: to, open: 100, high: 101, low: 99, close: 100, volume: 10 },
      { timestamp: to, open: 101, high: 102, low: 100, close: 101, volume: 20 },
    ];
    http.expectOne((request) => request.url === '/api/market/candles' && request.params.get('symbol') === 'AAPL')
      .flush({ sessionId: 7, symbol: 'AAPL', timeframe: '1D', marketTimestamp: to, points });
    http.expectOne((request) => request.url === '/api/market/candles' && request.params.get('symbol') === 'MSFT')
      .flush({ points });
    expect(received).toHaveLength(2);
    expect(received.every((series) => series.points.length === 2)).toBe(true);
    service.candles(7, 'AAPL', '1D').subscribe((series) => expect(series.points).toHaveLength(2));
    http.expectNone((request) => request.url === '/api/market/candles');
  });

  it('does not discard detailed history when a live tick crosses a minute during its request', () => {
    service.snapshot().subscribe();
    http.expectOne('/api/market/snapshot').flush({
      sessionId: 7, marketTimestamp: '2026-01-05T17:30:59Z', stocks: [],
    });
    vi.stubGlobal('EventSource', FakeEventSource);
    const disconnect = service.connect(7, { tick: vi.fn(), status: vi.fn(), resync: vi.fn() });
    const received: CandleSeries[] = [];
    service.candles(7, 'AAPL', '1D').subscribe((series) => received.push(series));
    const request = http.expectOne((request) => request.url === '/api/market/candles');
    FakeEventSource.last!.listeners.get('market-tick')!({ data: JSON.stringify({
      eventId: 1, marketTimestamp: '2026-01-05T17:31:00Z',
      serverTimestamp: '2026-01-05T17:31:00Z', prices: [],
    }) } as MessageEvent<string>);
    request.flush({ points: [{ close: 100 }, { close: 101 }] });
    expect(received[0].points).toHaveLength(2);
    disconnect();
  });

  it('allows history retry after a clock request fails and cancels a seek on logout', () => {
    service.setClock(7, '2026-01-05T17:30:00Z').subscribe({ error: () => undefined });
    service.candles(7, 'AAPL', '1D').subscribe({ error: () => undefined });
    http.expectOne((request) => request.url === '/api/market/clock')
      .flush({}, { status: 500, statusText: 'Error' });
    service.candles(7, 'AAPL', '1D').subscribe();
    http.expectOne((request) => request.url === '/api/market/candles').flush({ points: [] });
    service.setClock(7, '2026-01-05T14:30:00Z').subscribe();
    const clock = http.expectOne((request) => request.url === '/api/market/clock');
    TestBed.inject(TokenStorageService).clear();
    expect(clock.cancelled).toBe(true);
  });

  it('does not cache failures and bounds completed entries to 64', () => {
    service.candles(7, 'AAPL', '1D').subscribe({ error: () => undefined });
    http.expectOne((request) => request.url === '/api/market/candles').flush({}, { status: 503, statusText: 'Unavailable' });
    for (let index = 0; index < 65; index++) {
      service.candles(7, `S${index}`, '1D').subscribe();
      http.expectOne((request) => request.url === '/api/market/candles').flush({ points: [] });
    }
    service.candles(7, 'S0', '1D').subscribe();
    http.expectOne((request) => request.url === '/api/market/candles').flush({ points: [] });
    service.candles(7, 'AAPL', '1D').subscribe();
    http.expectOne((request) => request.url === '/api/market/candles').flush({ points: [] });
  });

  it('delivers a replacement session snapshot while invalidating old-session candles', () => {
    const snapshot = { sessionId: 7, marketTimestamp: '2026-01-05T16:00:00Z', stocks: [] };
    service.snapshot().subscribe();
    http.expectOne('/api/market/snapshot').flush(snapshot);
    service.candles(7, 'AAPL', '1D').subscribe();
    const old = http.expectOne((request) => request.url === '/api/market/candles');
    const seen: number[] = [];
    service.snapshot().subscribe((value) => seen.push(value.sessionId));
    http.expectOne('/api/market/snapshot').flush({ ...snapshot, sessionId: 8 });
    expect(seen).toEqual([7, 8]);
    expect(old.cancelled).toBe(true);
  });

});
