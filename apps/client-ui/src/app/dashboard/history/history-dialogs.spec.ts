import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AccountStore } from '../accounts/account-store.service';
import { CashTransaction } from '../accounts/account.models';
import { InstrumentRef, OrderResult } from '../orders/order.models';
import { OrderService } from '../orders/order.service';
import { TransactionsDialogComponent } from './transactions-dialog.component';
import { Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { orderHistoryRow, cashHistoryRow } from '../shared/activity';

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
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('TransactionsDialogComponent', () => {
    const CASH: CashTransaction[] = [
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
      click(fixture, '[data-testid="transactions-filters"]');
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

    it('filters by status and combines it with the type filter', () => {
      seedOrders();
      const fixture = open();
      const statuses = () => rows(fixture, 'transactions-row').map((row) => row.dataset['status']);
      click(fixture, '[data-testid="transactions-filters"]');
      click(fixture, '[data-testid="transactions-status-completed"]');
      expect(statuses()).toEqual(['COMPLETED', 'COMPLETED']);
      click(fixture, '[data-testid="transactions-filter-buy"]');
      expect(statuses()).toEqual([]);
      click(fixture, '[data-testid="transactions-filter-all"]');
      click(fixture, '[data-testid="transactions-status-all"]');
      expect(statuses()).toHaveLength(5);
    });

    it('filters by order kind and shows non-market kinds beside the type', () => {
      const service = TestBed.inject(OrderService);
      service.loadOrders().subscribe();
      http.expectOne('/api/orders').flush([
        order({ orderId: 1 }),
        order({ orderId: 2, executionType: 'LIMIT', limitPrice: 95, status: 'ACCEPTED' }),
        order({ orderId: 3, executionType: 'STOP', stopPrice: 90, status: 'ACCEPTED' }),
      ]);
      service.instruments().subscribe();
      http.expectOne('/api/instruments').flush(CATALOGUE);
      const fixture = open();
      const ids = () => rows(fixture, 'transactions-row').length;
      click(fixture, '[data-testid="transactions-filters"]');
      click(fixture, '[data-testid="transactions-execution-limit"]');
      expect(ids()).toBe(1);
      expect(rows(fixture, 'transaction-execution').map((el) => el.textContent?.trim())).toEqual([
        'Limit',
      ]);
      click(fixture, '[data-testid="transactions-execution-market"]');
      expect(ids()).toBe(1);
      expect(rows(fixture, 'transaction-execution')).toHaveLength(0);
      click(fixture, '[data-testid="transactions-execution-all"]');
      expect(ids()).toBe(5);
    });

    it('wires the header, close button, filter escape key and order menu to the dialog', () => {
      const service = TestBed.inject(OrderService);
      service.loadOrders().subscribe();
      http.expectOne('/api/orders').flush([order({ orderId: 1, status: 'ACCEPTED' })]);
      service.instruments().subscribe();
      http.expectOne('/api/instruments').flush(CATALOGUE);
      const fixture = open();
      const component = fixture.componentInstance;
      const root: HTMLElement = fixture.nativeElement;

      (root.querySelector('[app-sort-header]') as HTMLElement).click();
      fixture.detectChanges();
      expect(component['sortDirection']()).toBe('asc');

      click(fixture, '[data-testid="transactions-filters"]');
      const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      root.querySelector('[data-testid="transactions-filters-panel"]')!.dispatchEvent(escape);
      fixture.detectChanges();
      expect(component['filtersOpen']()).toBe(false);

      const edit = vi.spyOn(service, 'editOrder').mockImplementation(() => {});
      const cancel = vi.spyOn(service, 'cancelOrder').mockReturnValue(new Subject<OrderResult>());
      const menuItem = (name: string) =>
        [...root.querySelectorAll<HTMLElement>('[role="menuitem"], button')].find(
          (el) => el.textContent?.trim() === name,
        )!;
      // jsdom does not implement the modal dialog the cancel confirmation opens.
      const confirmation = root.querySelector('dialog') as HTMLDialogElement;
      confirmation.showModal = vi.fn();
      confirmation.close = vi.fn();
      menuItem('Edit order').click();
      expect(edit).toHaveBeenCalledWith(1);
      menuItem('Cancel order').click();
      fixture.detectChanges();
      menuItem('Confirm cancellation').click();
      expect(cancel).toHaveBeenCalledWith(1);

      const closed = vi.fn();
      component.closed.subscribe(closed);
      click(fixture, '[aria-label="Close recent transactions"]');
      expect(closed).toHaveBeenCalledOnce();
    });

    it('filters by account, names the account on each row and leaves out shared cash', () => {
      const service = TestBed.inject(OrderService);
      service.loadOrders().subscribe();
      http.expectOne('/api/orders').flush([
        order({ orderId: 1, accountId: 1 }),
        order({ orderId: 2, accountId: 2 }),
      ]);
      service.instruments().subscribe();
      http.expectOne('/api/instruments').flush(CATALOGUE);
      const fixture = open();
      const component = fixture.componentInstance;
      expect(rows(fixture, 'transaction-account').map((el) => el.textContent?.trim())).toEqual([
        'All accounts',
        'Account',
        'Account',
        'All accounts',
      ]);
      TestBed.inject(AccountStore)['_accounts'].set([
        { accountId: 1, name: 'Main', openedDate: '2026-01-01' },
        { accountId: 2, name: 'Growth', openedDate: '2026-01-01' },
      ]);
      fixture.detectChanges();
      click(fixture, '[data-testid="transactions-filters"]');
      const pressed = (id: string) =>
        fixture.nativeElement
          .querySelector(`[data-testid="transactions-account-${id}"]`)
          .getAttribute('aria-pressed');
      expect(pressed('all')).toBe('true');
      click(fixture, '[data-testid="transactions-account-2"]');
      expect(pressed('2')).toBe('true');
      expect(pressed('all')).toBe('false');
      expect(rows(fixture, 'transactions-row')).toHaveLength(1);
      expect(component['activeFilters']()).toBe(1);
      click(fixture, '[data-testid="transactions-account-1"]');
      expect(rows(fixture, 'transactions-row')).toHaveLength(1);
      click(fixture, '[data-testid="transactions-account-all"]');
      expect(rows(fixture, 'transactions-row')).toHaveLength(4);
      component['accountId'].set(2);
      component['execution'].set('LIMIT');
      expect(component['activeFilters']()).toBe(2);
      fixture.detectChanges();
      click(fixture, '[data-testid="transactions-filters-clear"]');
      expect(component['activeFilters']()).toBe(0);
      expect(rows(fixture, 'transactions-row')).toHaveLength(4);
    });

    it('searches asset labels and toggles sorting in both directions', () => {
      seedOrders(); const fixture = open(); const component = fixture.componentInstance;
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      input.value = ' aapl '; input.dispatchEvent(new Event('input')); fixture.detectChanges();
      expect(rows(fixture, 'transactions-row')).toHaveLength(2);
      component['sortBy']('date'); expect(component['sortDirection']()).toBe('asc');
      component['sortBy']('date'); expect(component['sortDirection']()).toBe('desc');
      component['sortBy']('shares'); expect(component['sortKey']()).toBe('shares');
      input.value = 'unknown'; input.dispatchEvent(new Event('input')); fixture.detectChanges();
      expect(rows(fixture, 'transactions-row')).toHaveLength(0);
    });

    it('prevents duplicate cancellation, refreshes balances and reports failures', () => {
      seedOrders(); const fixture = open(); const component = fixture.componentInstance;
      const service = TestBed.inject(OrderService); const store = TestBed.inject(AccountStore);
      const pending = new Subject<OrderResult>();
      const cancel = vi.spyOn(service, 'cancelOrder').mockReturnValue(pending);
      const reload = vi.spyOn(store, 'load').mockImplementation(() => {});
      const row = orderHistoryRow(order({ status: 'ACCEPTED' }), CATALOGUE, 'Main');
      component['cancelOrder'](cashHistoryRow(CASH[0])); expect(cancel).not.toHaveBeenCalled();
      component['cancelOrder'](row); component['cancelOrder'](row);
      expect(cancel).toHaveBeenCalledOnce(); expect(component['cancelling']().has(1)).toBe(true);
      pending.next(order({ status: 'CANCELLED' }));
      expect(component['cancelling']().size).toBe(0); expect(reload).toHaveBeenCalledWith(true);
      cancel.mockReturnValue(throwError(() => new Error('offline')));
      component['cancelOrder'](row); expect(component['loadError']()).toBe(true);
      expect(component['cancelling']().size).toBe(0);
    });

    it('loads audit once, ignores cash and retries failed audit requests', () => {
      seedOrders(); const fixture = open(); const component = fixture.componentInstance;
      const audit = vi.spyOn(TestBed.inject(OrderService), 'orderAudit');
      const row = orderHistoryRow(order(), CATALOGUE, 'Main');
      component['toggleAudit'](cashHistoryRow(CASH[0])); expect(audit).not.toHaveBeenCalled();
      component['toggleAudit'](row);
      component['toggleAudit'](row); component['toggleAudit'](row);
      expect(audit).toHaveBeenCalledOnce();
      http.expectOne('/api/orders/1/audit').flush({}, { status: 503, statusText: 'Unavailable' });
      fixture.detectChanges(); expect(component['auditErrors']().has(1)).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('Unable to load this order');
      component['toggleAudit'](row); component['toggleAudit'](row);
      http.expectOne('/api/orders/1/audit').flush([]); fixture.detectChanges();
      expect(component['auditLoading']().size).toBe(0);
      expect(component['auditErrors']().size).toBe(0);
      expect(fixture.nativeElement.textContent).toContain('No audit events were recorded');
      component['toggleAudit'](row); component['toggleAudit'](row);
      expect(audit).toHaveBeenCalledTimes(2);
    });

    it.each(['REJECTED', 'EXECUTION_FAILED'])('marks %s audit failures in the loss color', (eventType) => {
      const fixture = open();
      expect(fixture.componentInstance['auditMarkerClass']({ eventType, price: 100, occurredAt: '', detail: null }))
        .toBe('bg-loss');
    });

    it.each([
      ['FILLED', 'bg-gain'],
      ['PENDING', 'bg-pending'],
      ['ACCEPTED', 'bg-primary'],
    ])('marks %s audit events with %s', (eventType, expected) => {
      const fixture = open();
      expect(
        fixture.componentInstance['auditMarkerClass']({ eventType, price: 100, occurredAt: '', detail: null }),
      ).toBe(expected);
    });

    it('closes only the filter panel on Escape and clears the filters', () => {
      seedOrders();
      const fixture = open();
      const component = fixture.componentInstance;
      const event = new Event('keydown');
      const stop = vi.spyOn(event, 'stopPropagation');
      component['closeFilters'](event);
      expect(stop).not.toHaveBeenCalled();
      click(fixture, '[data-testid="transactions-filters"]');
      click(fixture, '[data-testid="transactions-filter-buy"]');
      click(fixture, '[data-testid="transactions-filters-clear"]');
      expect(rows(fixture, 'transactions-row')).toHaveLength(5);
      fixture.nativeElement.querySelector('[data-testid="transactions-filters-panel"]').previousElementSibling.click();
      fixture.detectChanges();
      expect(component['filtersOpen']()).toBe(false);
      component['filtersOpen'].set(true);
      component['closeFilters'](event);
      expect(stop).toHaveBeenCalledOnce();
      expect(component['filtersOpen']()).toBe(false);
    });

    it('colors and signs only cash amounts', () => {
      seedOrders();
      const fixture = open();
      const amount = (row: HTMLElement) => row.querySelector('[data-testid="transaction-amount"]') as HTMLElement;
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

    it('expands an order into its pending-to-final audit timeline', () => {
      seedOrders();
      const fixture = open();
      click(fixture, '[data-testid="transactions-order-1"]');
      expect(
        fixture.nativeElement.querySelector('[data-testid="audit-trail-1"]')?.textContent,
      ).toContain('Loading audit trail');
      http.expectOne('/api/orders/1/audit').flush([
        {
          eventType: 'PENDING',
          price: 100,
          occurredAt: '2026-01-05T15:59:00Z',
          detail: null,
        },
        {
          eventType: 'ACCEPTED',
          price: 100,
          occurredAt: '2026-01-05T15:59:30Z',
          detail: null,
        },
        {
          eventType: 'FILLED',
          price: 100,
          occurredAt: '2026-01-05T16:00:00Z',
          detail: 'Filled 2 @ 100.00',
        },
      ]);
      fixture.detectChanges();

      const trail = fixture.nativeElement.querySelector('[data-testid="audit-trail-1"]');
      expect(trail.textContent).toContain('PENDING');
      expect(trail.textContent).toContain('ACCEPTED');
      expect(trail.textContent).toContain('FILLED');
      expect(trail.textContent).toContain('$100.00');
      expect(fixture.nativeElement.querySelector('[data-testid="transactions-order-1"]')?.getAttribute('aria-expanded')).toBe('true');

      click(fixture, '[data-testid="transactions-order-1"]');
      expect(fixture.nativeElement.querySelector('[data-testid="audit-trail-1"]')).toBeNull();
    });

    it('shows placeholder rows until the cash ledger arrives', () => {
      const fixture = TestBed.createComponent(TransactionsDialogComponent);
      fixture.detectChanges();
      const table: HTMLElement = fixture.nativeElement.querySelector(
        '[data-testid="transactions-table"]',
      );
      const placeholders = rows(fixture, 'transactions-row-skeleton');

      expect(placeholders).toHaveLength(6);
      // Seven data placeholders, with reserved audit and action columns on either side.
      expect(placeholders[0].children).toHaveLength(10);
      expect(placeholders[0].getAttribute('aria-hidden')).toBe('true');
      expect(table.querySelector('[role="status"]')?.textContent).toContain('Loading transactions…');
      expect(table.textContent).not.toContain('No transactions match these filters.');

      http.expectOne((request) => request.url === '/api/me/cash-transactions').flush([]);
      fixture.detectChanges();
      expect(rows(fixture, 'transactions-row-skeleton')).toHaveLength(0);
      expect(table.querySelector('[role="status"]')).toBeNull();
      expect(table.textContent).toContain('No transactions match these filters.');
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

    describe('pagination', () => {
      // 40 deposits, one a minute apart, the newest first once sorted by date.
      const MANY: CashTransaction[] = Array.from({ length: 40 }, (_, index) => ({
        cashTransactionId: index + 1,
        amount: 100 + index,
        reason: 'DEPOSIT',
        createdAt: new Date(Date.UTC(2026, 0, 5, 15, index)).toISOString(),
      }));

      function openMany() {
        const fixture = TestBed.createComponent(TransactionsDialogComponent);
        fixture.detectChanges();
        http
          .expectOne((request) => request.url === '/api/me/cash-transactions')
          .flush(MANY);
        fixture.detectChanges();
        return fixture;
      }

      const pageLabel = (fixture: ComponentFixture<unknown>) =>
        fixture.nativeElement
          .querySelector('[data-testid="transactions-page"]')
          .textContent.trim();

      const countLabel = (fixture: ComponentFixture<unknown>) =>
        fixture.nativeElement
          .querySelector('[data-testid="transactions-count"]')
          .textContent.trim();

      it('shows fifteen transactions a page and reports the total', () => {
        const fixture = openMany();
        expect(rows(fixture, 'transactions-row')).toHaveLength(15);
        expect(pageLabel(fixture)).toBe('Page 1 of 3');
        expect(countLabel(fixture)).toBe('1–15 of 40 transactions');
      });

      it('says which transactions each page holds out of the total', () => {
        const fixture = openMany();
        click(fixture, '[data-testid="transactions-next"]');
        expect(countLabel(fixture)).toBe('16–30 of 40 transactions');
        click(fixture, '[data-testid="transactions-next"]');
        expect(countLabel(fixture)).toBe('31–40 of 40 transactions');
      });

      it('gives a plain total when everything fits on one page', () => {
        const fixture = open();
        expect(countLabel(fixture)).toBe('2 transactions');
      });

      it('pages forward and back, with the last page holding the remainder', () => {
        const fixture = openMany();
        click(fixture, '[data-testid="transactions-next"]');
        expect(pageLabel(fixture)).toBe('Page 2 of 3');
        expect(rows(fixture, 'transactions-row')).toHaveLength(15);
        click(fixture, '[data-testid="transactions-next"]');
        expect(pageLabel(fixture)).toBe('Page 3 of 3');
        expect(rows(fixture, 'transactions-row')).toHaveLength(10);
        const next = fixture.nativeElement.querySelector('[data-testid="transactions-next"]');
        expect(next.disabled).toBe(true);
        click(fixture, '[data-testid="transactions-prev"]');
        expect(pageLabel(fixture)).toBe('Page 2 of 3');
      });

      it('disables Previous on the first page', () => {
        const fixture = openMany();
        const previous = fixture.nativeElement.querySelector('[data-testid="transactions-prev"]');
        expect(previous.disabled).toBe(true);
      });

      it('returns to the first page when the listing changes', () => {
        const fixture = openMany();
        click(fixture, '[data-testid="transactions-next"]');
        expect(pageLabel(fixture)).toBe('Page 2 of 3');
        click(fixture, '[data-testid="transactions-filters"]');
        click(fixture, '[data-testid="transactions-filter-deposit"]');
        expect(pageLabel(fixture)).toBe('Page 1 of 3');
        click(fixture, '[data-testid="transactions-next"]');
        click(fixture, '.dash-table-head button');
        expect(pageLabel(fixture)).toBe('Page 1 of 3');
      });

      it('has no pager when everything fits on one page', () => {
        const fixture = open();
        expect(fixture.nativeElement.querySelector('[data-testid="transactions-page"]')).toBeNull();
        expect(fixture.nativeElement.querySelector('[data-testid="transactions-next"]')).toBeNull();
      });

      it('exports every filtered transaction, not just the page on screen', async () => {
        const fixture = openMany();
        let blob: Blob | null = null;
        URL.createObjectURL = vi.fn((made: Blob) => {
          blob = made;
          return 'blob:statement';
        });
        URL.revokeObjectURL = vi.fn();
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
        click(fixture, '[data-testid="transactions-export"]');
        click(fixture, '[data-testid="transactions-export-csv"]');
        await fixture.whenStable();
        const text = await (blob as unknown as Blob).text();
        expect(text.split('\r\n').filter(Boolean)).toHaveLength(41);
        vi.restoreAllMocks();
      });
    });

    describe('date range', () => {
      function setDate(fixture: ComponentFixture<unknown>, testId: string, value: string): void {
        const input = fixture.nativeElement.querySelector(
          `[data-testid="${testId}"]`,
        ) as HTMLInputElement;
        input.value = value;
        input.dispatchEvent(new Event('input'));
        fixture.detectChanges();
      }

      // The date the table shows for a UTC instant, in this machine's time zone.
      function localDay(iso: string): string {
        const date = new Date(iso);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      }

      it('keeps every row inside the range and none outside it', () => {
        seedOrders();
        const fixture = open();
        setDate(fixture, 'transactions-from', '2026-01-04');
        setDate(fixture, 'transactions-to', '2026-01-07');
        expect(rows(fixture, 'transactions-row')).toHaveLength(5);
        setDate(fixture, 'transactions-from', '2026-01-07');
        setDate(fixture, 'transactions-to', '');
        expect(rows(fixture, 'transactions-row')).toHaveLength(0);
        setDate(fixture, 'transactions-from', '');
        setDate(fixture, 'transactions-to', '2026-01-04');
        expect(rows(fixture, 'transactions-row')).toHaveLength(0);
      });

      it('includes the whole of the first and last day', () => {
        const fixture = open();
        const day = localDay('2026-01-05T19:00:00Z');
        setDate(fixture, 'transactions-from', day);
        setDate(fixture, 'transactions-to', day);
        // The 19:00 UTC withdrawal falls on that day wherever the machine is.
        expect(rows(fixture, 'transactions-row').length).toBeGreaterThan(0);
        expect(rows(fixture, 'transactions-count').length).toBe(1);
      });

      it('narrows the count and combines with the other filters', () => {
        seedOrders();
        const fixture = open();
        setDate(fixture, 'transactions-from', '2026-01-04');
        click(fixture, '[data-testid="transactions-filters"]');
        click(fixture, '[data-testid="transactions-filter-deposit"]');
        expect(rows(fixture, 'transactions-row')).toHaveLength(1);
        setDate(fixture, 'transactions-from', '2026-01-07');
        expect(rows(fixture, 'transactions-row')).toHaveLength(0);
      });

      it('stops each date passing the other', () => {
        const fixture = open();
        setDate(fixture, 'transactions-from', '2026-01-04');
        setDate(fixture, 'transactions-to', '2026-01-07');
        const from = fixture.nativeElement.querySelector('[data-testid="transactions-from"]');
        const to = fixture.nativeElement.querySelector('[data-testid="transactions-to"]');
        expect(from.getAttribute('max')).toBe('2026-01-07');
        expect(to.getAttribute('min')).toBe('2026-01-04');
      });
    });

    describe('exporting the statement', () => {
      const exportButton = (fixture: ComponentFixture<unknown>): HTMLButtonElement =>
        fixture.nativeElement.querySelector('[data-testid="transactions-export"]');

      afterEach(() => vi.restoreAllMocks());

      it('is disabled until the ledger has loaded', () => {
        const fixture = TestBed.createComponent(TransactionsDialogComponent);
        fixture.detectChanges();
        expect(exportButton(fixture).disabled).toBe(true);
        http.expectOne((request) => request.url === '/api/me/cash-transactions').flush(CASH);
        fixture.detectChanges();
        expect(exportButton(fixture).disabled).toBe(false);
      });

      it('is disabled when the filters leave nothing to export', () => {
        const fixture = open();
        fixture.nativeElement.querySelector('input[type="search"]').value = 'ZZZZ';
        fixture.nativeElement
          .querySelector('input[type="search"]')
          .dispatchEvent(new Event('input'));
        fixture.detectChanges();
        expect(exportButton(fixture).disabled).toBe(true);
      });

      it('downloads the filtered rows as a CSV file', async () => {
        seedOrders();
        const fixture = open();
        click(fixture, '[data-testid="transactions-filters"]');
        click(fixture, '[data-testid="transactions-filter-deposit"]');
        let blob: Blob | null = null;
        URL.createObjectURL = vi.fn((made: Blob) => {
          blob = made;
          return 'blob:statement';
        });
        URL.revokeObjectURL = vi.fn();
        let downloaded = '';
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
          this: HTMLAnchorElement,
        ) {
          downloaded = this.download;
        });

        click(fixture, '[data-testid="transactions-export"]');
        click(fixture, '[data-testid="transactions-export-csv"]');
        await fixture.whenStable();

        expect(downloaded).toMatch(/^account-statement-\d{4}-\d{2}-\d{2}\.csv$/);
        const text = await (blob as unknown as Blob).text();
        expect(text.split('\r\n').filter(Boolean)).toHaveLength(2);
        expect(text).toContain('Deposit');
        expect(text).not.toContain('Withdrawal');
        expect(text).not.toContain('AAPL');
      });

      it('downloads the filtered rows as a PDF file', async () => {
        const fixture = open();
        let blob: Blob | null = null;
        URL.createObjectURL = vi.fn((made: Blob) => {
          blob = made;
          return 'blob:statement';
        });
        URL.revokeObjectURL = vi.fn();
        let downloaded = '';
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
          this: HTMLAnchorElement,
        ) {
          downloaded = this.download;
        });

        click(fixture, '[data-testid="transactions-export"]');
        click(fixture, '[data-testid="transactions-export-pdf"]');
        await vi.waitFor(() => expect(downloaded).toMatch(/\.pdf$/));

        expect((blob as unknown as Blob).type).toBe('application/pdf');
      });

      it('closes only the export menu on Escape', () => {
        const fixture = open();
        const root: HTMLElement = fixture.nativeElement;
        const escape = () =>
          root
            .querySelector('[data-testid="transactions-export"]')!
            .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        const outer = vi.fn();
        root.addEventListener('keydown', outer);

        click(fixture, '[data-testid="transactions-export"]');
        expect(fixture.componentInstance['exportOpen']()).toBe(true);
        escape();
        fixture.detectChanges();
        expect(fixture.componentInstance['exportOpen']()).toBe(false);
        expect(outer).not.toHaveBeenCalled();

        // With the menu already shut, Escape is left for the dialog around it.
        escape();
        expect(outer).toHaveBeenCalledOnce();
      });

      it('reports a failed export', async () => {
        const fixture = open();
        URL.createObjectURL = vi.fn(() => {
          throw new Error('blocked');
        });
        click(fixture, '[data-testid="transactions-export"]');
        click(fixture, '[data-testid="transactions-export-csv"]');
        await fixture.whenStable();
        fixture.detectChanges();
        expect(
          fixture.nativeElement.querySelector('[data-testid="transactions-export-error"]'),
        ).not.toBeNull();
      });
    });
  });
});
