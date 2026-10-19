import { ToastService } from '../../notifications/toast.service';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UnknownInstrumentError } from './order-error';
import { InstrumentRef, OrderResult, OrderStatusFrame } from './order.models';
import { OrderService, STREAM_RECONNECT_MS } from './order.service';
import { TokenStorageService } from '../../core/auth/token-storage.service';
import { vi } from 'vitest';

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

  it('posts cancellation and immediately replaces the cached open order', () => {
    service.loadOrders().subscribe();
    http.expectOne('/api/orders').flush([order({ status: 'ACCEPTED', reservedCash: 200 })]);
    service.cancelOrder(1).subscribe();
    const cancelled = order({ status: 'CANCELLED', reservedCash: 0 });
    http.expectOne({ method: 'POST', url: '/api/orders/1/cancel' }).flush(cancelled);
    expect(service.orders()).toEqual([cancelled]);
    expect(service.orders()[0].reservedCash).toBe(0);
  });

  it('opens the editor with the saved order and routes edits to atomic replacement', () => {
    const original = order({ orderId: 1, status: 'ACCEPTED', accountId: 42, instrumentId: 7, executionType: 'LIMIT', limitPrice: 95, reservedCash: 190 });
    service.loadOrders().subscribe(); http.expectOne('/api/orders').flush([original]);
    service.editOrder(1); http.expectOne('/api/instruments').flush([instrument()]);
    expect(service.editingOrder()).toEqual(original);
    service.submitOrder({ ...BUY, replacesOrderId: 1, executionType: 'LIMIT', limitPrice: 94 }).subscribe();
    const request = http.expectOne({ method: 'POST', url: '/api/orders/1/replace' });
    expect(request.request.body.limitPrice).toBe(94);
    request.flush(order({ orderId: 2, status: 'ACCEPTED', limitPrice: 94 }));
    expect(service.orders().find((item) => item.orderId === 1)?.status).toBe('CANCELLED');
    expect(service.orders()[0].orderId).toBe(2);
  });

  it('does not open the editor for an order that is missing or no longer open', () => {
    service.loadOrders().subscribe();
    http.expectOne('/api/orders').flush([order({ status: 'FILLED' })]);

    service.editOrder(1);
    service.editOrder(404);

    http.expectNone('/api/instruments');
    expect(service.editingOrder()).toBeNull();
  });

  it('retains the original cached order when a replacement is refused', () => {
    const original = order({ status: 'ACCEPTED', reservedCash: 200 });
    service.loadOrders().subscribe(); http.expectOne('/api/orders').flush([original]);
    service.instruments().subscribe(); http.expectOne('/api/instruments').flush([instrument()]);
    service.submitOrder({ ...BUY, replacesOrderId: 1, quantity: 1000 }).subscribe({ error: () => {} });
    http.expectOne('/api/orders/1/replace').flush({ error: 'Insufficient cash' }, { status: 400, statusText: 'Bad Request' });
    expect(service.orders()).toEqual([original]);
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

    it('posts a sell with the selected replay time and preserves the response', () => {
      const simulatedAt = '2026-01-05T16:30:00Z';
      const results: OrderResult[] = [];
      service.submitOrder({ ...BUY, orderType: 'SELL', simulatedAt }).subscribe(value => results.push(value));
      http.expectOne('/api/instruments').flush([instrument()]);
      const posted = http.expectOne({ method: 'POST', url: '/api/orders' });
      expect(posted.request.body).toMatchObject({ accountId: 42, instrumentId: 7,
        orderType: 'SELL', quantity: 2, indicativePrice: 100, simulatedAt });
      const response = order({ orderType: 'SELL', simulatedAt });
      posted.flush(response);
      expect(results).toEqual([response]);
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
  it('shares refreshes and never lets pre-submission history erase a new order', () => {
    service.instruments().subscribe();
    http.expectOne('/api/instruments').flush([instrument()]);
    service.loadOrders().subscribe(); service.loadOrders().subscribe();
    const old = http.expectOne('/api/orders');
    service.submitOrder({ accountId: 1, symbol: 'AAPL', orderType: 'BUY', quantity: 1, indicativePrice: 100 }).subscribe();
    const result = { orderId: 99, status: 'FILLED', orderType: 'BUY', quantity: 1, indicativePrice: 100 };
    http.expectOne({ method: 'POST', url: '/api/orders' }).flush(result);
    expect(service.orders()[0].orderId).toBe(99);
    old.flush([]);
    http.expectOne({ method: 'GET', url: '/api/orders' }).flush([result]);
    expect(service.orders()[0].orderId).toBe(99);
    service.loadOrders().subscribe({ error: () => undefined });
    expect(service.historyStatus()).toBe('ready');
    http.expectOne('/api/orders').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(service.orders()[0].orderId).toBe(99);
    expect(service.historyError()).toContain('Unable');
  });


  describe('the order status stream', () => {
    // One fake GET /api/orders/stream: the test writes server-sent events into it and can end
    // it, the way a dropped connection does.
    class FakeStream {
      readonly requests: RequestInit[] = [];
      // When set, the next open is answered with 503 and no body, like a service that is down.
      refuseNext = false;
      private controller?: ReadableStreamDefaultController<Uint8Array>;
      private opened?: () => void;
      readonly fetch = vi.fn((_: string, init?: RequestInit) => {
        this.requests.push(init ?? {});
        if (this.refuseNext) {
          this.refuseNext = false;
          return Promise.resolve(new Response(null, { status: 503 }));
        }
        const body = new ReadableStream<Uint8Array>({
          start: (controller) => {
            this.controller = controller;
            // Like a real fetch, an aborted request ends the body with an error.
            init?.signal?.addEventListener('abort', () => controller.error(new Error('aborted')));
            this.opened?.();
          },
        });
        return Promise.resolve(new Response(body, { status: 200 }));
      });

      send(event: string, data: unknown): void {
        this.raw(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }

      raw(text: string): void {
        this.controller?.enqueue(new TextEncoder().encode(text));
      }

      drop(): void {
        this.controller?.close();
      }

      // Resolves once the service has read the response and is waiting on frames.
      opening(): Promise<void> {
        return new Promise((resolve) => (this.opened = resolve));
      }
    }

    const tokens = { accessToken: 'token', refreshToken: 'refresh', expiresIn: 900 };
    let stream: FakeStream;

    function frame(overrides: Partial<OrderStatusFrame> = {}): OrderStatusFrame {
      return { orderId: 1, status: 'FILLED', rejectionReason: null, order: { resolvedAt: '2026-01-05T16:00:01Z' }, ...overrides };
    }

    // Lets the service's promise chain run between a frame being written and it being applied.
    // A message port is a macrotask that fake timers never touch, so this works while they run.
    const settle = () =>
      new Promise<void>((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => resolve();
        channel.port2.postMessage(0);
      });

    async function signIn(): Promise<void> {
      TestBed.inject(TokenStorageService).save(tokens);
      const opened = stream.opening();
      TestBed.tick();
      await opened;
    }

    async function loadOpenOrder(status: 'PENDING' | 'ACCEPTED' = 'PENDING'): Promise<void> {
      service.loadOrders().subscribe();
      http.expectOne('/api/orders').flush([order({ status, resolvedAt: null })]);
      await settle();
    }

    beforeEach(() => {
      stream = new FakeStream();
      vi.stubGlobal('fetch', stream.fetch);
      localStorage.clear();
    });
    afterEach(() => {
      TestBed.inject(TokenStorageService).clear();
      vi.unstubAllGlobals();
    });

    it('does not open the stream while signed out', () => {
      TestBed.tick();
      expect(stream.fetch).not.toHaveBeenCalled();
    });

    it('opens the stream with the bearer token once signed in', async () => {
      await signIn();
      expect(stream.fetch).toHaveBeenCalledWith('/api/orders/stream', expect.objectContaining({ cache: 'no-store' }));
      expect((stream.requests[0].headers as Record<string, string>)['Authorization']).toBe('Bearer token');
    });

    it('applies a fill from the stream and announces it', async () => {
      const filled: OrderResult[] = [];
      service.pendingFilled.subscribe((result) => filled.push(result));
      await signIn();
      await loadOpenOrder();

      stream.send('heartbeat', {});
      stream.send('order-status', frame({ status: 'ACCEPTED' }));
      await settle();
      expect(service.orders()[0].status).toBe('ACCEPTED');
      expect(filled).toEqual([]);

      stream.send('order-status', frame({ price: 101.5 }));
      await settle();
      expect(service.orders()[0]).toMatchObject({
        status: 'FILLED',
        resolvedAt: '2026-01-05T16:00:01Z',
        executionPrice: 101.5,
        reservedCash: 0,
      });
      expect(filled).toHaveLength(1);
      expect(TestBed.inject(ToastService).messages()[0].message).toBe('Filled 2 order #1 at $101.50.');
      http.expectNone('/api/orders');
    });

    it('applies a rejection with its reason without announcing a fill', async () => {
      const filled: OrderResult[] = [];
      service.pendingFilled.subscribe((result) => filled.push(result));
      await signIn();
      await loadOpenOrder();

      stream.send('order-status', frame({ status: 'REJECTED', rejectionReason: 'Insufficient funds' }));
      await settle();
      expect(service.orders()[0]).toMatchObject({ status: 'REJECTED', rejectionReason: 'Insufficient funds' });
      expect(filled).toEqual([]);
    });

    it('never moves a resolved order backwards when frames arrive late', async () => {
      await signIn();
      service.loadOrders().subscribe();
      http.expectOne('/api/orders').flush([order()]);

      stream.send('order-status', frame({ status: 'ACCEPTED' }));
      stream.raw('event: order-status\ndata: {not json\n\n');
      stream.send('order-status', { orderId: 'one', status: 'FILLED' });
      await settle();
      expect(service.orders()[0].status).toBe('FILLED');
    });

    it('re-reads the history for an order it has not seen', async () => {
      await signIn();
      stream.send('order-status', frame({ orderId: 77 }));
      await settle();
      http.expectOne('/api/orders').flush([order({ orderId: 77 })]);
      expect(service.orders().map((value) => value.orderId)).toEqual([77]);
    });

    it('reopens a dropped stream after a growing delay and catches up once', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      try {
        await signIn();
        stream.drop();
        await settle();
        expect(stream.fetch).toHaveBeenCalledTimes(1);

        // The first attempt comes after the initial delay, and the open connection re-reads the
        // history once to catch up.
        let reopened = stream.opening();
        vi.advanceTimersByTime(STREAM_RECONNECT_MS.initial);
        await reopened;
        await settle();
        expect(stream.fetch).toHaveBeenCalledTimes(2);
        http.expectOne('/api/orders').flush([order()]);

        // A refused attempt doubles the wait before the next one, and nothing is re-read until
        // a connection is actually open again.
        stream.drop();
        await settle();
        stream.refuseNext = true;
        vi.advanceTimersByTime(STREAM_RECONNECT_MS.initial);
        await settle();
        expect(stream.fetch).toHaveBeenCalledTimes(3);
        http.expectNone('/api/orders');
        vi.advanceTimersByTime(STREAM_RECONNECT_MS.initial);
        expect(stream.fetch).toHaveBeenCalledTimes(3);
        reopened = stream.opening();
        vi.advanceTimersByTime(STREAM_RECONNECT_MS.initial);
        await reopened;
        await settle();
        expect(stream.fetch).toHaveBeenCalledTimes(4);
        http.expectOne('/api/orders').flush([order()]);
      } finally {
        vi.useRealTimers();
      }
    });

    it('closes the stream on sign-out and opens a fresh one for the next sign-in', async () => {
      await signIn();
      const first = stream.requests[0].signal as AbortSignal;
      TestBed.inject(TokenStorageService).clear();
      TestBed.tick();
      expect(first.aborted).toBe(true);
      // The aborted read ends without scheduling a reconnect.
      await settle();
      await settle();
      expect(stream.fetch).toHaveBeenCalledTimes(1);

      await signIn();
      expect(stream.fetch).toHaveBeenCalledTimes(2);
    });

    it('does not open the stream where fetch is unavailable', () => {
      vi.stubGlobal('fetch', undefined);
      TestBed.inject(TokenStorageService).save(tokens);
      TestBed.tick();
      expect(stream.requests).toEqual([]);
    });

    it('gives up when the session cannot be renewed', () => {
      // An expired token with no refresh token ends the session instead of opening a stream.
      TestBed.inject(TokenStorageService).save({ ...tokens, refreshToken: '', expiresIn: -1 });
      TestBed.tick();
      expect(stream.fetch).not.toHaveBeenCalled();
      expect(TestBed.inject(TokenStorageService).hasSession()).toBe(false);
    });

    it('retries after a failed token renewal', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      try {
        TestBed.inject(TokenStorageService).save({ ...tokens, expiresIn: -1 });
        TestBed.tick();
        http.expectOne('http://localhost:3001/auth/refresh').flush({}, { status: 500, statusText: 'Down' });
        expect(stream.fetch).not.toHaveBeenCalled();

        const opened = stream.opening();
        vi.advanceTimersByTime(STREAM_RECONNECT_MS.initial);
        http.expectOne('http://localhost:3001/auth/refresh').flush({ ...tokens, accessToken: 'renewed' });
        await opened;
        await settle();
        expect((stream.requests[0].headers as Record<string, string>)['Authorization']).toBe('Bearer renewed');
        http.expectOne('/api/orders').flush([]);
      } finally {
        vi.useRealTimers();
      }
    });

    it('reads a frame with comment and id lines and fills in the fields it lacks', async () => {
      const filled: OrderResult[] = [];
      service.pendingFilled.subscribe((result) => filled.push(result));
      await signIn();
      await loadOpenOrder('ACCEPTED');

      stream.raw(': keep-alive\r\nid: 7\r\nevent: order-status\r\ndata: {"orderId":1,"status":"FILLED"}\r\n\r\n');
      await settle();
      expect(service.orders()[0]).toMatchObject({ status: 'FILLED', rejectionReason: null, resolvedAt: null });
      expect(filled).toHaveLength(1);
    });

    it('survives a failed catch-up read and a failed read for an unknown order', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      try {
        await signIn();
        stream.drop();
        await settle();
        const reopened = stream.opening();
        vi.advanceTimersByTime(STREAM_RECONNECT_MS.initial);
        await reopened;
        await settle();
        http.expectOne('/api/orders').flush({}, { status: 503, statusText: 'Unavailable' });

        stream.send('order-status', frame({ orderId: 77 }));
        await settle();
        http.expectOne('/api/orders').flush({}, { status: 503, statusText: 'Unavailable' });
        expect(service.orders()).toEqual([]);
        expect(service.historyStatus()).toBe('error');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it('tells the user when the order editor cannot load its instrument catalogue', () => {
    service.loadOrders().subscribe();
    http.expectOne('/api/orders').flush([order({ status: 'ACCEPTED' })]);
    service.editOrder(1);
    http.expectOne('/api/instruments').flush({}, { status: 500, statusText: 'Error' });

    expect(service.editingOrder()).toBeNull();
    expect(TestBed.inject(ToastService).messages()[0].message).toContain('Unable to load the order editor');
  });

  it('submits by instrument id and refuses an id the catalogue does not hold', () => {
    service.submitOrder({ ...BUY, instrumentId: 7 }).subscribe();
    http.expectOne('/api/instruments').flush([instrument()]);
    http.expectOne({ method: 'POST', url: '/api/orders' }).flush(order());

    let failure: unknown;
    service.submitOrder({ ...BUY, instrumentId: 99 }).subscribe({ error: (error) => (failure = error) });
    expect(failure).toBeInstanceOf(UnknownInstrumentError);
  });

  it('serves the cached history without a request when a refresh is not required', () => {
    service.loadOrders().subscribe();
    http.expectOne('/api/orders').flush([order()]);

    let cached: OrderResult[] = [];
    service.loadOrders(false).subscribe((orders) => (cached = orders));

    http.expectNone('/api/orders');
    expect(cached).toEqual([order()]);
  });

});
