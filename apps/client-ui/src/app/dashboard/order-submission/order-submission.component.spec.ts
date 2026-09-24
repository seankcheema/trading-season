import { TestBed } from '@angular/core/testing';
import { OrderSubmissionComponent } from './order-submission.component';
import { Instrument } from '../mock-data';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

const INSTRUMENT: Instrument = {
  symbol: 'AAPL',
  name: 'Apple Inc.',
  price: 316.59,
  change: 15.65,
  changePercent: 5.2,
};

describe('OrderSubmissionComponent', () => {
  function setup(positions: Record<string, number> = {}) {
    const fixture = TestBed.createComponent(OrderSubmissionComponent);
    fixture.componentRef.setInput('instrument', INSTRUMENT);
    fixture.componentRef.setInput('accountId', 'personal');
    fixture.componentRef.setInput('cashBalance', 10_000);
    fixture.componentRef.setInput('positions', positions);
    return fixture;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderSubmissionComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
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

  it('should emit the order on submit', () => {
    const component = setup().componentInstance;
    const emitted: unknown[] = [];
    component.submitted.subscribe((order) => emitted.push(order));
    component['shares'].set(2);
    component['submit']();
    expect(emitted).toEqual([
      { accountId: 'personal', symbol: 'AAPL', side: 'buy', shares: 2, price: 316.59 },
    ]);
  });

  it('should resolve the active instrument from live input updates', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('instruments', [{ ...INSTRUMENT, price: 400, change: 99 }]);

    expect(component['activeInstrument']().price).toBe(400);
    expect(component['maxShares']()).toBe(25);
    component['shares'].set(2);

    const emitted: unknown[] = [];
    component.submitted.subscribe((order) => emitted.push(order));
    component['submit']();

    expect(component['orderValue']()).toBe(800);
    expect(emitted).toEqual([
      { accountId: 'personal', symbol: 'AAPL', side: 'buy', shares: 2, price: 400 },
    ]);
  });

  it('should limit the fallback chart to the elapsed market session', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('marketTimestamp', '2026-01-05T16:00:00Z');

    const points = component['chartPoints']();

    expect(points[0].time.toISOString()).toBe('2026-01-05T15:30:00.000Z');
    expect(points[points.length - 1].time.toISOString()).toBe('2026-01-05T16:00:00.000Z');
    expect(points.every((point) => point.time.getTime() <= Date.parse('2026-01-05T16:00:00Z'))).toBe(
      true,
    );
  });

  it('should include the exact cursor between regular chart samples', () => {
    const fixture = setup();
    fixture.componentRef.setInput('marketTimestamp', '2026-01-05T16:07:00Z');

    const points = fixture.componentInstance['chartPoints']();

    expect(points[points.length - 1].time.toISOString()).toBe('2026-01-05T16:07:00.000Z');
  });

  it('should preserve the complete session at market close', () => {
    const fixture = setup();
    fixture.componentRef.setInput('marketTimestamp', '2026-01-05T22:00:00Z');

    const points = fixture.componentInstance['chartPoints']();

    expect(points).toHaveLength(27);
    expect(points[0].time.toISOString()).toBe('2026-01-05T15:30:00.000Z');
    expect(points[points.length - 1].time.toISOString()).toBe('2026-01-05T22:00:00.000Z');
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

      setShares(slider, '500');
      expect(shares()).toBe(31);

      setShares(sharesInput, '-3');
      expect(shares()).toBe(0);

      setShares(sharesInput, 'abc');
      expect(shares()).toBe(0);
    });

    it('should submit from the button and do nothing when there is nothing to trade', () => {
      const { fixture, sharesInput, submitButton } = render();
      const emitted: unknown[] = [];
      fixture.componentInstance.submitted.subscribe((order) => emitted.push(order));

      setShares(sharesInput, '3');
      fixture.detectChanges();
      submitButton().click();
      expect(emitted).toEqual([
        { accountId: 'personal', symbol: 'AAPL', side: 'buy', shares: 3, price: 316.59 },
      ]);

      setShares(sharesInput, '0');
      fixture.componentInstance['submit']();
      expect(emitted).toHaveLength(1);
    });

    it('should swap the instrument from the in-dialog search', () => {
      const { fixture, el } = render();
      fixture.componentRef.setInput('instruments', [
        INSTRUMENT,
        { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 100, change: -2, changePercent: -1.96 },
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

    it('should fall back to the generated series when candles fail to load', () => {
      const fixture = setup();
      fixture.componentRef.setInput('sessionId', 3);
      fixture.componentRef.setInput('marketTimestamp', '2026-01-05T16:00:00Z');
      fixture.detectChanges();

      TestBed.inject(HttpTestingController)
        .expectOne((r) => r.url === '/api/market/candles')
        .flush('down', { status: 503, statusText: 'Service Unavailable' });

      const points = fixture.componentInstance['chartPoints']();
      expect(points[0].time.toISOString()).toBe('2026-01-05T15:30:00.000Z');
    });
  });
});
