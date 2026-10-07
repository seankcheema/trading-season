import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OrderService } from './order.service';
import { TradeEligibilityError, toOrderErrorMessage } from './order-error';

describe('Trade eligibility before submission', () => {
  let orders: OrderService;
  let http: HttpTestingController;
  const trade = {
    accountId: 1,
    symbol: 'AAPL',
    quantity: 10,
    indicativePrice: 100,
    orderType: 'BUY' as const,
    sessionId: 7,
  };
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    orders = TestBed.inject(OrderService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function catalogue() {
    http
      .expectOne('/api/instruments')
      .flush([{ instrumentId: 2, ticker: 'AAPL', simulatedStockSymbol: 'AAPL' }]);
  }
  it('checks once and preserves the reference price and session', () => {
    let result: unknown;
    orders.submitOrder(trade).subscribe((value) => (result = value));
    catalogue();
    const check = http.expectOne('/api/orders/check');
    expect(check.request.body).toMatchObject({ sessionId: 7, indicativePrice: 100 });
    expect(check.request.body.clientReference).toBeUndefined();
    http.expectNone('/api/orders');
    check.flush({ eligible: true, executionPrice: 100.5 });
    const submit = http.expectOne('/api/orders');
    expect(submit.request.body).toMatchObject({ sessionId: 7, indicativePrice: 100 });
    expect(submit.request.body.clientReference).toBeTruthy();
    const fill = { orderId: 1, status: 'FILLED', executionPrice: 100.75, indicativePrice: 100 };
    submit.flush(fill);
    expect(result).toEqual(fill);
    expect(orders.orders()).toEqual([fill]);
  });
  it('shows failed eligibility without creating an order or changing history', () => {
    let error: unknown;
    orders.submitOrder(trade).subscribe({ error: (value) => (error = value) });
    catalogue();
    http
      .expectOne('/api/orders/check')
      .flush({ eligible: false, rejectionReason: 'Execution price is outside your buffer.' });
    expect(error).toBeInstanceOf(TradeEligibilityError);
    expect(toOrderErrorMessage(error)).toBe('Execution price is outside your buffer.');
    http.expectNone('/api/orders');
    expect(orders.orders()).toEqual([]);
  });
  it('does not submit when the advisory API is unavailable', () => {
    orders.submitOrder(trade).subscribe({ error: () => {} });
    catalogue();
    http.expectOne('/api/orders/check').flush({}, { status: 503, statusText: 'Unavailable' });
    http.expectNone('/api/orders');
  });
});
