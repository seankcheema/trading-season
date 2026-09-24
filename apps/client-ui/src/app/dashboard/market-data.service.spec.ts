import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MarketDataService, MarketStreamHandlers } from './market-data.service';

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
    });
  });
});
