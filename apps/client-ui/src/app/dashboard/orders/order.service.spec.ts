import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UnknownInstrumentError } from './order-error';
import { InstrumentRef, OrderResult } from './order.models';
import { OrderService } from './order.service';

function instrument(overrides: Partial<InstrumentRef> = {}): InstrumentRef {
  return {
    instrumentId: 7,
    ticker: 'AAPL',
    name: 'Apple Inc.',
    assetClass: 'Equity',
    market: 'US',
    currency: 'USD',
    tradable: true,
    simulatedStockSymbol: 'AAPL',
    ...overrides,
  };
}

function order(overrides: Partial<OrderResult> = {}): OrderResult {
  return {
    orderId: 1,
    status: 'FILLED',
    orderType: 'BUY',
    quantity: 2,
    indicativePrice: 100,
    rejectionReason: null,
    submittedAt: '2026-01-05T16:00:00Z',
    resolvedAt: '2026-01-05T16:00:00Z',
    ...overrides,
  };
}

const BUY = {
  accountId: 42,
  symbol: 'AAPL',
  orderType: 'BUY' as const,
  quantity: 2,
  indicativePrice: 100,
};

describe('OrderService', () => {
  let service: OrderService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [OrderService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OrderService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reports a failed history load and recovers on retry', () => {
    service.loadOrders().subscribe({ error: () => {} });
    http.expectOne('/api/orders').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(service.historyStatus()).toBe('error');
    service.loadOrders().subscribe();
    http.expectOne('/api/orders').flush([order()]);
    expect(service.historyStatus()).toBe('ready');
    expect(service.orders()).toEqual([order()]);
  });

  describe('instruments', () => {
    it('should fetch the catalogue once and share it between callers', () => {
      const first: InstrumentRef[][] = [];
      const second: InstrumentRef[][] = [];

      service.instruments().subscribe((value) => first.push(value));
      service.instruments().subscribe((value) => second.push(value));
      http.expectOne({ method: 'GET', url: '/api/instruments' }).flush([instrument()]);

      // A third subscriber after the response still gets the cached catalogue, not a request.
      service.instruments().subscribe((value) => second.push(value));

      expect(service.catalogue()).toEqual([instrument()]);
      expect(first).toHaveLength(1);
      expect(second).toHaveLength(2);
      expect(first[0][0].instrumentId).toBe(7);
      http.expectNone({ method: 'GET', url: '/api/instruments' });
    });
  });

  describe('instrumentFor', () => {
    it('should match the market-data symbol ahead of another instrument ticker', () => {
      // The symbol a quote arrives under is simulatedStockSymbol. Here one instrument's
      // ticker collides with another's market symbol, and the market symbol must win.
      const matches: (InstrumentRef | null)[] = [];
      service.instrumentFor('AAPL').subscribe((value) => matches.push(value));
      http
        .expectOne({ method: 'GET', url: '/api/instruments' })
        .flush([
          instrument({ instrumentId: 1, ticker: 'AAPL', simulatedStockSymbol: 'APLX' }),
          instrument({ instrumentId: 2, ticker: 'AAPL2', simulatedStockSymbol: 'AAPL' }),
        ]);

      expect(matches[0]?.instrumentId).toBe(2);
    });

    it('should fall back to the ticker for an instrument nothing simulates', () => {
      const matches: (InstrumentRef | null)[] = [];
      service.instrumentFor('btc').subscribe((value) => matches.push(value));
      http
        .expectOne({ method: 'GET', url: '/api/instruments' })
        .flush([
          instrument({ instrumentId: 9, ticker: 'BTC', market: null, simulatedStockSymbol: null }),
        ]);

      expect(matches[0]?.instrumentId).toBe(9);
    });

    it('should report no match for an unknown or blank symbol', () => {
      const matches: (InstrumentRef | null)[] = [];
      service.instrumentFor('ZZZZ').subscribe((value) => matches.push(value));
      http.expectOne({ method: 'GET', url: '/api/instruments' }).flush([instrument()]);
      service.instrumentFor('   ').subscribe((value) => matches.push(value));

      expect(matches).toEqual([null, null]);
    });
  });

  describe('submitOrder', () => {
    it('should resolve the symbol and post the order', () => {
      const results: OrderResult[] = [];
      service.submitOrder(BUY).subscribe((value) => results.push(value));
      http.expectOne({ method: 'GET', url: '/api/instruments' }).flush([instrument()]);

      const request = http.expectOne({ method: 'POST', url: '/api/orders' });
      expect(request.request.body).toMatchObject({
        accountId: 42,
        instrumentId: 7,
        orderType: 'BUY',
        quantity: 2,
        indicativePrice: 100,
      });
      request.flush(order());

      expect(results).toEqual([order()]);
    });

    it('should send a distinct v4 idempotency key per submission', () => {
      const keys: string[] = [];
      for (const _ of [0, 1]) {
        service.submitOrder(BUY).subscribe();
        if (keys.length === 0) {
          http.expectOne({ method: 'GET', url: '/api/instruments' }).flush([instrument()]);
        }
        const request = http.expectOne({ method: 'POST', url: '/api/orders' });
        keys.push(request.request.body.clientReference);
        request.flush(order());
      }

      expect(keys[0]).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(keys[0]).not.toBe(keys[1]);
    });

    it('should fail without a request when no instrument matches the symbol', () => {
      const errors: unknown[] = [];
      service.submitOrder({ ...BUY, symbol: 'ZZZZ' }).subscribe({
        error: (error: unknown) => errors.push(error),
      });
      http.expectOne({ method: 'GET', url: '/api/instruments' }).flush([instrument()]);

      expect(errors[0]).toBeInstanceOf(UnknownInstrumentError);
      expect((errors[0] as UnknownInstrumentError).symbol).toBe('ZZZZ');
      http.expectNone({ method: 'POST', url: '/api/orders' });
    });

    it('should record a filled order in the history it already holds', () => {
      service.loadOrders().subscribe();
      http.expectOne({ method: 'GET', url: '/api/orders' }).flush([order({ orderId: 1 })]);

      service.submitOrder(BUY).subscribe();
      http.expectOne({ method: 'GET', url: '/api/instruments' }).flush([instrument()]);
      http.expectOne({ method: 'POST', url: '/api/orders' }).flush(order({ orderId: 2 }));

      // Newest first, matching the order the backend lists them in.
      expect(service.orders().map((value) => value.orderId)).toEqual([2, 1]);
    });

    it('should leave the history untouched when the submission fails', () => {
      service.submitOrder(BUY).subscribe({ error: () => undefined });
      http.expectOne({ method: 'GET', url: '/api/instruments' }).flush([instrument()]);
      http
        .expectOne({ method: 'POST', url: '/api/orders' })
        .flush(null, { status: 500, statusText: 'Server Error' });

      expect(service.orders()).toEqual([]);
    });
  });

  describe('the idempotency key without crypto.randomUUID', () => {
    // randomUUID needs a secure context, which the dev server over plain HTTP on a
    // non-localhost host is not. The order still has to carry a well-formed v4 UUID,
    // because the backend parses the field as one.
    const realCrypto = globalThis.crypto;

    function stubCrypto(value: unknown): void {
      Object.defineProperty(globalThis, 'crypto', {
        value,
        configurable: true,
        writable: true,
      });
    }

    afterEach(() => stubCrypto(realCrypto));

    function submitAndReadKey(): string {
      service.submitOrder(BUY).subscribe();
      http.expectOne({ method: 'GET', url: '/api/instruments' }).flush([instrument()]);
      const request = http.expectOne({ method: 'POST', url: '/api/orders' });
      const key = request.request.body.clientReference as string;
      request.flush(order());
      return key;
    }

    it('should build the key from getRandomValues, with the v4 version and variant bits set', () => {
      // Every byte 0xff, so only the bits the function must overwrite can differ.
      stubCrypto({
        getRandomValues: (bytes: Uint8Array) => {
          bytes.fill(0xff);
          return bytes;
        },
      });

      expect(submitAndReadKey()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
    });

    it('should still build a valid key with no web crypto at all', () => {
      stubCrypto(undefined);

      const key = submitAndReadKey();

      expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should pad a zero byte rather than emit a short key', () => {
      // A byte below 0x10 is one hex digit; unpadded it would shift the whole key left.
      stubCrypto({
        getRandomValues: (bytes: Uint8Array) => {
          bytes.fill(0x00);
          return bytes;
        },
      });

      expect(submitAndReadKey()).toBe('00000000-0000-4000-8000-000000000000');
    });
  });

  it('shows a newly submitted execution once even when its response repeats', () => {
    service.loadOrders().subscribe();
    http.expectOne('/api/orders').flush([order()]);
    service.submitOrder(BUY).subscribe();
    http.expectOne('/api/instruments').flush([instrument()]);
    http.expectOne('/api/orders').flush(order());
    expect(service.orders()).toHaveLength(1);
    service.submitOrder(BUY).subscribe();
    http.expectOne('/api/orders').flush(order({ orderId: 2 }));
    expect(service.orders().map((value) => value.orderId)).toEqual([2, 1]);
  });

  describe('loadOrders', () => {
    it('should replace the cached history rather than append to it', () => {
      service.loadOrders().subscribe();
      http.expectOne({ method: 'GET', url: '/api/orders' }).flush([order({ orderId: 1 })]);
      service.loadOrders().subscribe();
      http.expectOne({ method: 'GET', url: '/api/orders' }).flush([order({ orderId: 5 })]);

      expect(service.orders().map((value) => value.orderId)).toEqual([5]);
    });

    it('should start empty for a caller who has not traded', () => {
      expect(service.orders()).toEqual([]);

      service.loadOrders().subscribe();
      http.expectOne({ method: 'GET', url: '/api/orders' }).flush([]);

      expect(service.orders()).toEqual([]);
    });
  });
});
