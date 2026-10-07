import { HttpResponse, withInterceptors } from '@angular/common/http';
import { of as eligibleResponse } from 'rxjs';
import { vi, afterEach } from 'vitest';
import { ToastService } from '../../notifications/toast.service';
import { TestBed } from '@angular/core/testing';
import { OrderSubmissionComponent } from './order-submission.component';
import { Instrument } from '../mock-data';
import { InstrumentRef, OrderResult } from '../orders/order.models';
import { OrderService } from '../orders/order.service';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

const INSTRUMENT: Instrument = {
  symbol: 'AAPL',
  name: 'Apple Inc.',
  price: 316.59,
  change: 15.65,
  changePercent: 5.2,
};

// The account the dialog places orders against. Numeric, because the backend's accountId is.
const ACCOUNT_ID = '42';

const CATALOGUE: InstrumentRef[] = [
  {
    instrumentId: 7,
    ticker: 'AAPL',
    name: 'Apple Inc.',
    assetClass: 'Equity',
    market: 'US',
    currency: 'USD',
    tradable: true,
    simulatedStockSymbol: 'AAPL',
  },
  {
    instrumentId: 8,
    ticker: 'NVDA',
    name: 'NVIDIA Corporation',
    assetClass: 'Equity',
    market: 'US',
    currency: 'USD',
    tradable: true,
    simulatedStockSymbol: 'NVDA',
  },
];

function filledOrder(overrides: Partial<OrderResult> = {}): OrderResult {
  return {
    orderId: 1,
    status: 'FILLED',
    orderType: 'BUY',
    quantity: 2,
    indicativePrice: 316.59,
    rejectionReason: null,
    submittedAt: '2026-01-05T16:00:00Z',
    resolvedAt: '2026-01-05T16:00:00Z',
    ...overrides,
  };
}

describe('OrderSubmissionComponent', () => {
  function setup(positions: Record<string, number> = {}) {
    const fixture = TestBed.createComponent(OrderSubmissionComponent);
    fixture.componentRef.setInput('instrument', INSTRUMENT);
    fixture.componentRef.setInput('accountId', ACCOUNT_ID);
    fixture.componentRef.setInput('cashBalance', 10_000);
    fixture.componentRef.setInput('positions', positions);
    return fixture;
  }

  afterEach(() => vi.useRealTimers());

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [OrderSubmissionComponent],
      providers: [
        OrderService,
        provideHttpClient(
          withInterceptors([
            (req, next) =>
              req.url.endsWith('/orders/check')
                ? eligibleResponse(new HttpResponse({ body: { eligible: true } }))
                : next(req),
          ]),
        ),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();
  });

  it('should cap buys at the shares the cash balance can afford', () => {
    const component = setup().componentInstance;
    expect(component['maxShares']()).toBe(31);
  });

  it('should cap sells at the shares held', () => {
    const component = setup({ AAPL: 4 }).componentInstance;
    component['side'].set('sell');
    expect(component['maxShares']()).toBe(4);
  });

  it('should compute cash after a buy', () => {
    const component = setup().componentInstance;
    component['shares'].set(2);
    expect(component['orderValue']()).toBeCloseTo(633.18);
    expect(component['cashAfter']()).toBeCloseTo(9366.82);
  });

  it.each(['2026-01-06T17:00:00Z', '2026-01-05T16:00:00Z', 'invalid'])(
    'uses the selected replay timestamp %s at submission with a real-time fallback',
    (timestamp) => {
      const fixture = setup();
      fixture.componentRef.setInput('marketTimestamp', timestamp);
      fixture.detectChanges();
      fixture.componentInstance['submit']();
      const http = TestBed.inject(HttpTestingController);
      http.expectOne('/api/instruments').flush(CATALOGUE);
      const posted = http.expectOne({ method: 'POST', url: '/api/orders' });
      expect(posted.request.body.simulatedAt).toBe(
        timestamp === 'invalid' ? undefined : new Date(timestamp).toISOString(),
      );
      posted.flush(filledOrder());
      http.verify();
    },
  );

  it('should post the order and emit the outcome the backend returned', () => {
    const http = TestBed.inject(HttpTestingController);
    const component = setup().componentInstance;
    const emitted: OrderResult[] = [];
    component.submitted.subscribe((order) => emitted.push(order));
    component['shares'].set(2);

    component['submit']();
    expect(component['submitting']()).toBe(true);

    // The symbol has to be resolved to an instrument id before the order can be placed.
    http.expectOne({ method: 'GET', url: '/api/instruments' }).flush(CATALOGUE);
    const posted = http.expectOne({ method: 'POST', url: '/api/orders' });
    expect(posted.request.body).toMatchObject({
      accountId: 42,
      instrumentId: 7,
      orderType: 'BUY',
      quantity: 2,
      indicativePrice: 316.59,
    });
    expect(posted.request.body.clientReference).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    posted.flush(filledOrder());

    expect(component['submitting']()).toBe(false);
    expect(component['filled']()).toBe(true);
    expect(emitted).toEqual([filledOrder()]);
    http.verify();
  });

  it('keeps the submitted symbol in the notification after the dialog is destroyed', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = setup();
    const component = fixture.componentInstance;
    component['shares'].set(2);
    component['submit']();
    http.expectOne({ method: 'GET', url: '/api/instruments' }).flush(CATALOGUE);
    const posted = http.expectOne({ method: 'POST', url: '/api/orders' });
    component['activeSymbol'].set('NVDA');
    fixture.destroy();
    posted.flush(filledOrder());
    expect(TestBed.inject(ToastService).messages()[0].message).toBe('Filled 2 AAPL at $316.59.');
    http.verify();
  });

  for (const side of ['buy', 'sell'] as const) {
    it(`allows consecutive ${side}s but blocks clicks while pending`, () => {
      const http = TestBed.inject(HttpTestingController);
      const fixture = setup({ AAPL: 5 });
      const component = fixture.componentInstance;
      fixture.detectChanges();
      component['side'].set(side);
      fixture.detectChanges();
      component['shares'].set(2);
      const emitted: OrderResult[] = [];
      component.submitted.subscribe((result) => emitted.push(result));
      component['submit']();
      component['submit']();
      http.expectOne({ method: 'GET', url: '/api/instruments' }).flush(CATALOGUE);
      const first = http.expectOne({ method: 'POST', url: '/api/orders' });
      const reference = first.request.body.clientReference;
      expect(component['canSubmit']()).toBe(false);
      first.flush(filledOrder({ orderType: side === 'buy' ? 'BUY' : 'SELL' }));
      expect(component['canSubmit']()).toBe(false);
      expect(component['submitLabel']()).toBe(side === 'buy' ? 'Buying\u2026' : 'Selling\u2026');
      vi.advanceTimersByTime(999);
      expect(component['canSubmit']()).toBe(false);
      vi.advanceTimersByTime(1);
      expect(component['canSubmit']()).toBe(true);
      expect(component['submitLabel']()).toBe(`${side === 'buy' ? 'Buy' : 'Sell'} 2 AAPL`);
      component['submit']();
      const second = http.expectOne({ method: 'POST', url: '/api/orders' });
      expect(second.request.body.clientReference).not.toBe(reference);
      second.flush(filledOrder({ orderId: 2, orderType: side === 'buy' ? 'BUY' : 'SELL' }));
      expect(emitted).toHaveLength(2);
      expect(
        TestBed.inject(OrderService)
          .orders()
          .map((order) => order.orderId),
      ).toEqual([2, 1]);
      expect(TestBed.inject(ToastService).messages()).toHaveLength(1);
      if (side === 'buy') fixture.componentRef.setInput('cashBalance', 0);
      else fixture.componentRef.setInput('positions', { AAPL: 0 });
      fixture.detectChanges();
      expect(component['shares']()).toBe(0);
      expect(component['canSubmit']()).toBe(false);
      component['submit']();
      http.expectNone({ method: 'POST', url: '/api/orders' });
      http.verify();
    });
  }

  it('keeps the spinner and lock active when the request takes longer than one second', () => {
    const http = TestBed.inject(HttpTestingController);
    const component = setup().componentInstance;
    component['submit']();
    http.expectOne({ method: 'GET', url: '/api/instruments' }).flush(CATALOGUE);
    const request = http.expectOne({ method: 'POST', url: '/api/orders' });
    vi.advanceTimersByTime(1500);
    expect(component['busy']()).toBe(true);
    expect(component['canSubmit']()).toBe(false);
    component['submit']();
    http.expectNone({ method: 'POST', url: '/api/orders' });
    request.flush(filledOrder());
    expect(component['busy']()).toBe(false);
    expect(component['canSubmit']()).toBe(true);
    http.verify();
  });

  it('should send a sell as a SELL order', () => {
    const http = TestBed.inject(HttpTestingController);
    const component = setup({ AAPL: 5 }).componentInstance;
    component['side'].set('sell');
    component['shares'].set(3);

    component['submit']();
    http.expectOne({ method: 'GET', url: '/api/instruments' }).flush(CATALOGUE);
    const posted = http.expectOne({ method: 'POST', url: '/api/orders' });

    expect(posted.request.body).toMatchObject({ orderType: 'SELL', quantity: 3, instrumentId: 7 });
    posted.flush(filledOrder({ orderType: 'SELL', quantity: 3 }));
    expect(component['filled']()).toBe(true);
    expect(TestBed.inject(ToastService).messages()[0].message).toBe('Filled 3 AAPL at $316.59.');
    http.verify();
  });

  it('should show a rejection as the order outcome rather than an error', () => {
    const http = TestBed.inject(HttpTestingController);
    const component = setup().componentInstance;
    const emitted: OrderResult[] = [];
    component.submitted.subscribe((order) => emitted.push(order));
    component['shares'].set(2);

    component['submit']();
    http.expectOne({ method: 'GET', url: '/api/instruments' }).flush(CATALOGUE);
    http.expectOne({ method: 'POST', url: '/api/orders' }).flush(
      filledOrder({
        status: 'REJECTED',
        rejectionReason: 'BR-09: insufficient funds for this order',
      }),
    );

    expect(component['rejectionReason']()).toBe('BR-09: insufficient funds for this order');
    expect(component['errorMessage']()).toBe('');
    expect(component['filled']()).toBe(false);
    // A rejection leaves the ticket usable, so the trader can change it and retry.
    vi.advanceTimersByTime(1000);
    expect(component['canSubmit']()).toBe(true);
    expect(emitted).toHaveLength(1);
    http.verify();
  });

  it('should fall back to a generic reason for a rejection the backend did not explain', () => {
    const http = TestBed.inject(HttpTestingController);
    const component = setup().componentInstance;
    component['shares'].set(2);

    component['submit']();
    http.expectOne({ method: 'GET', url: '/api/instruments' }).flush(CATALOGUE);
    http
      .expectOne({ method: 'POST', url: '/api/orders' })
      .flush(filledOrder({ status: 'REJECTED', rejectionReason: null }));

    expect(component['rejectionReason']()).toBe('The order was rejected.');
    http.verify();
  });

  it('should show a message when the submission itself fails', () => {
    const http = TestBed.inject(HttpTestingController);
    const component = setup().componentInstance;
    component['shares'].set(2);

    component['submit']();
    http.expectOne({ method: 'GET', url: '/api/instruments' }).flush(CATALOGUE);
    http
      .expectOne({ method: 'POST', url: '/api/orders' })
      .flush({ error: 'nope' }, { status: 403, statusText: 'Forbidden' });

    expect(component['submitting']()).toBe(false);
    expect(component['errorMessage']()).toBe("That account isn't available to you.");
    expect(component['outcome']()).toBeNull();
    http.verify();
  });

  it('should refuse to submit without an account to trade against', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = setup();
    fixture.componentRef.setInput('accountId', '');
    const component = fixture.componentInstance;
    component['shares'].set(2);

    component['submit']();

    expect(component['errorMessage']()).toBe('Select an account before placing an order.');
    http.expectNone({ method: 'POST', url: '/api/orders' });
  });

  it('should report a symbol the catalogue does not carry', () => {
    const http = TestBed.inject(HttpTestingController);
    const component = setup().componentInstance;
    component['shares'].set(2);

    component['submit']();
    http.expectOne({ method: 'GET', url: '/api/instruments' }).flush([]);

    expect(component['errorMessage']()).toBe(
      "We couldn't find that symbol. Pick another and try again.",
    );
    http.expectNone({ method: 'POST', url: '/api/orders' });
  });

  it('should clear a previous outcome when the ticket changes', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = setup({ AAPL: 5 });
    const component = fixture.componentInstance;
    component['shares'].set(2);

    component['submit']();
    http.expectOne({ method: 'GET', url: '/api/instruments' }).flush(CATALOGUE);
    http.expectOne({ method: 'POST', url: '/api/orders' }).flush(filledOrder());
    expect(component['filled']()).toBe(true);

    component['side'].set('sell');
    fixture.detectChanges();

    expect(component['outcome']()).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(component['canSubmit']()).toBe(true);
    http.verify();
  });

  it('should resolve the active instrument from live input updates', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('instruments', [{ ...INSTRUMENT, price: 400, change: 99 }]);

    expect(component['activeInstrument']().price).toBe(400);
    expect(component['maxShares']()).toBe(25);
    component['shares'].set(2);

    const http = TestBed.inject(HttpTestingController);
    component['submit']();
    http.expectOne({ method: 'GET', url: '/api/instruments' }).flush(CATALOGUE);

    expect(component['orderValue']()).toBe(800);
    // The live price is what the order is submitted at, not the price the dialog opened with.
    expect(http.expectOne({ method: 'POST', url: '/api/orders' }).request.body).toMatchObject({
      instrumentId: 7,
      quantity: 2,
      indicativePrice: 400,
    });
  });

  it('should link the original modal to the canonical full-screen symbol route', () => {
    const fixture = setup();
    expect(fixture.componentInstance['fullScreenUrl']()).toEqual(['/dashboard/markets', 'aapl']);
  });

  it('does not generate placeholder history before market data arrives', () => {
    const fixture = setup();
    fixture.componentRef.setInput('marketTimestamp', '2026-01-05T16:00:00Z');
    expect(fixture.componentInstance['chartPoints']()).toEqual([]);
  });

  describe('rendered dialog', () => {
    function render(positions: Record<string, number> = {}) {
      const fixture = setup(positions);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const sideButton = (label: string) =>
        Array.from(el.querySelectorAll<HTMLButtonElement>('[aria-label="Order side"] button')).find(
          (b) => b.textContent?.trim() === label,
        )!;
      const sharesInput = el.querySelector<HTMLInputElement>('#order-shares')!;
      const slider = el.querySelector<HTMLInputElement>('input[type="range"]')!;
      const submitButton = () =>
        Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
          /^(Buy|Sell) \d+ /.test(b.textContent?.trim() ?? ''),
        )!;
      return { fixture, el, sideButton, sharesInput, slider, submitButton };
    }

    function setShares(input: HTMLInputElement, value: string) {
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }

    it('should close from the close button, the backdrop and Escape, but not from inside the dialog', () => {
      const { fixture, el } = render();
      let closes = 0;
      fixture.componentInstance.closed.subscribe(() => closes++);

      el.querySelector<HTMLButtonElement>('[aria-label="Close order submission"]')!.click();
      expect(closes).toBe(1);

      el.querySelector<HTMLElement>('section[role="dialog"]')!.click();
      expect(closes).toBe(1);

      el.querySelector<HTMLElement>('.order-backdrop')!.click();
      expect(closes).toBe(2);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(closes).toBe(3);
    });

    it('should switch to selling and label the ticket accordingly', () => {
      const { fixture, sideButton, submitButton, el } = render({ AAPL: 4 });

      sideButton('sell').click();
      fixture.detectChanges();

      expect(sideButton('sell').getAttribute('aria-pressed')).toBe('true');
      expect(sideButton('buy').getAttribute('aria-pressed')).toBe('false');
      expect(submitButton().textContent).toContain('Sell 1 AAPL');
      expect(el.textContent).toContain('Estimated proceeds');
      expect(el.textContent).toContain('Max 4');
      expect(fixture.componentInstance['cashAfter']()).toBeCloseTo(10_316.59);
    });

    it('should explain an empty sell ticket and disable its controls', () => {
      const { fixture, sideButton, sharesInput, slider, submitButton, el } = render();

      sideButton('sell').click();
      fixture.detectChanges();

      expect(el.textContent).toContain('No shares held');
      expect(sharesInput.disabled).toBe(true);
      expect(slider.disabled).toBe(true);
      expect(submitButton().disabled).toBe(true);
    });

    it('should explain when cash cannot cover a single share', () => {
      const { fixture, el } = render();
      fixture.componentRef.setInput('cashBalance', 10);
      fixture.detectChanges();

      expect(el.textContent).toContain('Insufficient cash');
    });

    it('should clamp typed and slid share counts to the allowed range', () => {
      const { fixture, sharesInput, slider } = render();
      const shares = () => fixture.componentInstance['shares']();

      setShares(sharesInput, '12.9');
      expect(shares()).toBe(12);
      expect(sharesInput.value).toBe('12');
      setShares(sharesInput, '500');
      setShares(sharesInput, '600');
      expect(sharesInput.value).toBe('31');

      setShares(slider, '500');
      expect(shares()).toBe(31);

      setShares(sharesInput, '-3');
      expect(shares()).toBe(0);
      expect(sharesInput.value).toBe('0');

      setShares(sharesInput, 'abc');
      expect(shares()).toBe(0);
      expect(sharesInput.value).toBe('0');
    });

    it('preserves valid quantities and clamps when live limits shrink', () => {
      const { fixture, sharesInput, slider, sideButton } = render({ AAPL: 4.8 });
      setShares(sharesInput, '12');
      fixture.componentRef.setInput('cashBalance', 20_000);
      fixture.detectChanges();
      expect(sharesInput.value).toBe('12');
      fixture.componentRef.setInput('instruments', [{ ...INSTRUMENT, price: 5000 }]);
      fixture.detectChanges();
      expect(sharesInput.value).toBe('4');
      expect(slider.value).toBe('4');
      sideButton('sell').click();
      fixture.detectChanges();
      expect(sharesInput.value).toBe('4');
      fixture.componentRef.setInput('positions', { AAPL: 2 });
      fixture.detectChanges();
      expect(sharesInput.value).toBe('2');
    });

    it('uses zero for invalid buy limits', () => {
      const { fixture, sharesInput } = render();
      for (const price of [0, -1, NaN, Infinity]) {
        fixture.componentRef.setInput('instruments', [{ ...INSTRUMENT, price }]);
        fixture.detectChanges();
        expect(sharesInput.value).toBe('0');
        expect(sharesInput.disabled).toBe(true);
      }
    });

    it('should submit from the button and do nothing when there is nothing to trade', () => {
      const http = TestBed.inject(HttpTestingController);
      const { fixture, sharesInput, submitButton, el } = render();
      const emitted: OrderResult[] = [];
      fixture.componentInstance.submitted.subscribe((order) => emitted.push(order));

      setShares(sharesInput, '3');
      fixture.detectChanges();
      submitButton().click();
      http.expectOne({ method: 'GET', url: '/api/instruments' }).flush(CATALOGUE);
      http.expectOne({ method: 'POST', url: '/api/orders' }).flush(filledOrder({ quantity: 3 }));
      vi.advanceTimersByTime(1000);
      fixture.detectChanges();

      expect(emitted).toHaveLength(1);
      expect(TestBed.inject(ToastService).messages()[0].message).toBe('Filled 3 AAPL at $316.59.');
      expect(el.querySelector('[data-testid="order-filled"]')).toBeNull();
      expect(submitButton().disabled).toBe(false);

      setShares(sharesInput, '0');
      fixture.componentInstance['submit']();
      expect(emitted).toHaveLength(1);
      http.verify();
    });

    it('should notify a rejection and a failure outside the ticket', () => {
      const http = TestBed.inject(HttpTestingController);
      const { fixture, sharesInput, submitButton, el } = render();

      setShares(sharesInput, '3');
      fixture.detectChanges();
      submitButton().click();
      http.expectOne({ method: 'GET', url: '/api/instruments' }).flush(CATALOGUE);
      http
        .expectOne({ method: 'POST', url: '/api/orders' })
        .flush(filledOrder({ status: 'REJECTED', rejectionReason: 'BR-05: not tradable' }));
      vi.advanceTimersByTime(1000);
      fixture.detectChanges();

      expect(TestBed.inject(ToastService).messages()[0].message).toBe(
        'Rejected: BR-05: not tradable',
      );
      expect(el.querySelector('[data-testid="order-rejected"]')).toBeNull();

      submitButton().click();
      http
        .expectOne({ method: 'POST', url: '/api/orders' })
        .flush(null, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();

      expect(TestBed.inject(ToastService).messages()[0].message).toContain(
        'The service is unavailable right now.',
      );
      expect(el.querySelector('[data-testid="order-error"]')).toBeNull();
      http.verify();
    });

    it('should swap the instrument from the in-dialog search', () => {
      const { fixture, el } = render();
      fixture.componentRef.setInput('instruments', [
        INSTRUMENT,
        {
          symbol: 'NVDA',
          name: 'NVIDIA Corporation',
          price: 100,
          change: -2,
          changePercent: -1.96,
        },
      ]);
      fixture.detectChanges();
      const search = el.querySelector<HTMLInputElement>('app-instrument-search input')!;

      search.dispatchEvent(new Event('focus'));
      search.value = 'nvda';
      search.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      el.querySelector<HTMLLIElement>('li[role="option"]')!.click();
      fixture.detectChanges();

      expect(fixture.componentInstance['activeInstrument']().symbol).toBe('NVDA');
      expect(el.textContent).toContain('NVIDIA Corporation');
      expect(el.textContent).toContain('-$2.00');
    });

    it('should change the chart timeframe from the toggle', () => {
      const { fixture, el } = render();
      const toggle = Array.from(
        el.querySelectorAll<HTMLButtonElement>('[aria-label="Chart timeframe"] button'),
      ).find((b) => b.textContent?.trim() === '1M')!;

      toggle.click();
      fixture.detectChanges();

      expect(fixture.componentInstance['timeframe']()).toBe('1M');
    });
  });

  describe('candle loading', () => {
    it('should chart loaded candles, ending on the live price at the market cursor', () => {
      const fixture = setup();
      fixture.componentRef.setInput('sessionId', 3);
      fixture.componentRef.setInput('marketTimestamp', '2026-01-05T16:00:00Z');
      fixture.detectChanges();

      const http = TestBed.inject(HttpTestingController);
      const req = http.expectOne((r) => r.url === '/api/market/candles');
      expect(req.request.params.get('symbol')).toBe('AAPL');
      req.flush({
        points: [
          { timestamp: '2026-01-05T15:30:00Z', close: 300 },
          { timestamp: '2026-01-05T15:45:00Z', close: 305 },
        ],
      });

      const points = fixture.componentInstance['chartPoints']();
      expect(points.map((p) => p.value)).toEqual([300, 316.59]);
      expect(points[1].time.toISOString()).toBe('2026-01-05T16:00:00.000Z');
      http.verify();
    });

    it('should keep the last candle time when there is no market cursor', () => {
      const fixture = setup();
      fixture.componentRef.setInput('sessionId', 3);
      fixture.detectChanges();

      TestBed.inject(HttpTestingController)
        .expectOne((r) => r.url === '/api/market/candles')
        .flush({ points: [{ timestamp: '2026-01-05T15:30:00Z', close: 300 }] });

      const [point] = fixture.componentInstance['chartPoints']();
      expect(point.time.toISOString()).toBe('2026-01-05T15:30:00.000Z');
      expect(point.value).toBe(316.59);
    });

    it('shows an error without fabricated history when candles fail to load', () => {
      const fixture = setup();
      fixture.componentRef.setInput('sessionId', 3);
      fixture.componentRef.setInput('marketTimestamp', '2026-01-05T16:00:00Z');
      fixture.detectChanges();

      TestBed.inject(HttpTestingController)
        .expectOne((r) => r.url === '/api/market/candles')
        .flush('down', { status: 503, statusText: 'Service Unavailable' });

      const points = fixture.componentInstance['chartPoints']();
      expect(points).toEqual([]);
      expect(fixture.componentInstance['chartError']()).toContain('could not refresh');
    });
  });
  it('retains the previous chart range during delayed timeframe refresh and after failure', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('sessionId', 3);
    fixture.componentRef.setInput('marketTimestamp', '2026-01-05T16:00:00Z');
    fixture.detectChanges();
    http
      .expectOne((request) => request.url === '/api/market/candles')
      .flush({
        points: [
          { timestamp: '2026-01-05T15:30:00Z', close: 310 },
          { timestamp: '2026-01-05T16:00:00Z', close: 316.59 },
        ],
      });
    fixture.detectChanges();
    const previous = component['chartPoints']();
    component['timeframe'].set('5D');
    fixture.detectChanges();
    const refresh = http.expectOne((request) => request.url === '/api/market/candles');
    expect(component['chartPoints']()).toEqual(previous);
    expect(component['chartTimeframe']()).toBe('1D');
    expect(fixture.nativeElement.querySelector('app-price-chart')).not.toBeNull();
    refresh.flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(component['chartPoints']()).toEqual(previous);
    expect(component['chartError']()).toContain('could not refresh');
    component['retryChart']();
    fixture.detectChanges();
    http.expectOne((request) => request.url === '/api/market/candles').flush({ points: [] });
    expect(component['chartPoints']()).toEqual([]);
  });
});
