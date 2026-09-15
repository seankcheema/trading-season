import { TestBed } from '@angular/core/testing';
import { OrderSubmissionComponent } from './order-submission.component';
import { Instrument } from '../mock-data';

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
});
