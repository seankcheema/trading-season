import { TestBed } from '@angular/core/testing';
import { OrderSubmissionComponent } from './order-submission.component';
import { Instrument } from '../mock-data';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

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
});
