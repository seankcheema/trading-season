import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AccountStore } from '../accounts/account-store.service';
import { InstrumentRef, OrderResult } from '../orders/order.models';
import { OrderService } from '../orders/order.service';
import { TransactionsDialogComponent } from './transactions-dialog.component';

const CATALOGUE: InstrumentRef[] = ['AAPL', 'MSFT'].map((symbol, index) => ({
  instrumentId: 7 + index,
  ticker: symbol,
  name: symbol,
  assetClass: 'Equity',
  market: 'US',
  currency: 'USD',
  tradable: true,
  simulatedStockSymbol: symbol,
}));

function order(overrides: Partial<OrderResult> = {}): OrderResult {
  return {
    orderId: 1,
    instrumentId: 7,
    accountId: 1,
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

const ORDERS = [
  order({ orderId: 1, resolvedAt: '2026-01-05T16:00:00Z' }),
  order({
    orderId: 2,
    instrumentId: 8,
    status: 'PENDING',
    resolvedAt: null,
    submittedAt: '2026-01-05T17:00:00Z',
  }),
  order({
    orderId: 3,
    orderType: 'SELL',
    status: 'REJECTED',
    rejectionReason: 'Insufficient holdings',
    resolvedAt: '2026-01-05T18:00:00Z',
  }),
];

function rows(fixture: ComponentFixture<unknown>, testId: string): HTMLElement[] {
  return [...fixture.nativeElement.querySelectorAll(`[data-testid="${testId}"]`)];
}

function click(fixture: ComponentFixture<unknown>, selector: string): void {
  fixture.nativeElement.querySelector(selector).click();
  fixture.detectChanges();
}

describe('history dialogs', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('TransactionsDialogComponent', () => {
    const CASH = [
      { cashTransactionId: 1, amount: 500, reason: 'DEPOSIT', createdAt: '2026-01-05T15:00:00Z' },
      { cashTransactionId: 2, amount: 50, reason: 'WITHDRAWAL', createdAt: '2026-01-05T19:00:00Z' },
    ];

    function open(marketTime: number | null = null) {
      const fixture = TestBed.createComponent(TransactionsDialogComponent);
      fixture.componentRef.setInput('marketTime', marketTime);
      fixture.detectChanges();
      // The full cash ledger is requested on open, beyond the dashboard's 20.
      http
        .expectOne(
          (request) =>
            request.url === '/api/me/cash-transactions' && request.params.get('limit') === '200',
        )
        .flush(CASH);
      fixture.detectChanges();
      return fixture;
    }

    function seedOrders(): void {
      const service = TestBed.inject(OrderService);
      service.loadOrders().subscribe();
      http.expectOne('/api/orders').flush(ORDERS);
      service.instruments().subscribe();
      http.expectOne('/api/instruments').flush(CATALOGUE);
      TestBed.inject(AccountStore);
    }

    it('combines cash transfers and orders of every status', () => {
      seedOrders();
      const fixture = open();
      expect(rows(fixture, 'transactions-row').map((row) => row.dataset['status'])).toEqual([
        'COMPLETED',
        'REJECTED',
        'PENDING',
        'FILLED',
        'COMPLETED',
      ]);
    });

    it('hides orders after the simulated clock but keeps cash', () => {
      seedOrders();
      const fixture = open(Date.parse('2026-01-05T16:30:00Z'));
      expect(rows(fixture, 'transactions-row').map((row) => row.dataset['status'])).toEqual([
        'COMPLETED',
        'FILLED',
        'COMPLETED',
      ]);
    });

    it('filters by type', () => {
      seedOrders();
      const fixture = open();
      const typed = (type: string) => {
        click(fixture, `[data-testid="transactions-filter-${type}"]`);
        return rows(fixture, 'transactions-row').length;
      };
      expect(typed('buy')).toBe(2);
      expect(typed('sell')).toBe(1);
      expect(typed('deposit')).toBe(1);
      expect(typed('withdrawal')).toBe(1);
      expect(typed('all')).toBe(5);
    });

    it('colors and signs only cash amounts', () => {
      seedOrders();
      const fixture = open();
      const amount = (row: HTMLElement) => row.firstElementChild!.lastElementChild as HTMLElement;
      for (const row of rows(fixture, 'transactions-row')) {
        const cell = amount(row);
        if (row.dataset['status'] === 'COMPLETED') {
          expect(cell.textContent).toMatch(/^\s*[+-]\$/);
          expect(cell.className).toMatch(/text-(gain|loss)/);
        } else {
          expect(cell.textContent).toMatch(/^\s*\$/);
          expect(cell.className).not.toMatch(/text-(gain|loss)/);
        }
      }
    });

    it('does not make rows clickable', () => {
      seedOrders();
      const fixture = open();
      expect(
        fixture.nativeElement.querySelectorAll('[data-testid="transactions-row"] button'),
      ).toHaveLength(0);
    });

    it('still shows the recent transfers when the full ledger cannot be loaded', () => {
      const fixture = TestBed.createComponent(TransactionsDialogComponent);
      fixture.detectChanges();
      http
        .expectOne((request) => request.url === '/api/me/cash-transactions')
        .flush({}, { status: 500, statusText: 'Error' });
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector('[data-testid="transactions-error"]'),
      ).not.toBeNull();
    });
  });
});
