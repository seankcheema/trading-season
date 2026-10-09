import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { orderDetail, orderRow, orderRows } from '../../testing/console-fixtures';
import { cells, text } from '../../testing/dom';
import { OrderDetail, OrderList, OrderRow } from '../reporting/console.models';
import { ReportingApiService } from '../reporting/reporting-api.service';
import { OrderDetailComponent, plainReason } from './order-detail.component';
import { OrderTableComponent, orderSortValue } from './order-table.component';
import { ORDERS_REFRESH_MS, OrdersComponent } from './orders.component';

describe('OrderTableComponent', () => {
  let fixture: ComponentFixture<OrderTableComponent>;
  const root = () => fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(root().querySelectorAll<HTMLButtonElement>('li > button'));
  const ids = () => rows().map((row) => cells(row)[0]);

  const render = (inputs: Record<string, unknown> = {}) => {
    fixture = TestBed.createComponent(OrderTableComponent);
    fixture.componentRef.setInput('orders', orderRows());
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
  };

  it('lists orders newest first with who placed them', () => {
    render();

    expect(cells(root().querySelector('.dash-table-head')!)).toEqual([
      'Order',
      'Time',
      'Customer',
      'Asset',
      'Side',
      'Qty',
      'Type',
      'Fill price',
      'Status',
    ]);
    expect(ids()).toEqual(['#10482', '#10481', '#10480']);
    const [id, time, customer, asset, side, quantity, type, price, status] = cells(rows()[0]);
    expect([id, customer, asset, side, quantity, type, price, status]).toEqual([
      '#10482',
      'Sean Cheema · Growth',
      'AAPL',
      'buy',
      '4',
      'MARKET',
      '$316.59',
      'filled',
    ]);
    expect(time).toMatch(/^Oct \d{1,2}, \d{1,2}:44:12 [AP]M$/);
    expect(rows()[0].getAttribute('aria-label')).toBe('Open order 10482');
  });

  it('colors a sell and a rejection, and dashes a missing fill price', () => {
    render();

    expect(rows()[0].querySelectorAll('app-change-pill')[0].className).toContain('text-primary');
    expect(rows()[1].querySelectorAll('app-change-pill')[0].className).toContain('text-loss');
    expect(rows()[2].querySelectorAll('app-change-pill')[1].className).toContain('text-loss');
    expect(cells(rows()[2])[7]).toBe('—');
  });

  it('sorts by a column heading and flips on the second click', () => {
    render();
    const heading = root().querySelector<HTMLButtonElement>('button[aria-label="Sort by Asset"]')!;

    heading.click();
    fixture.detectChanges();
    expect(rows().map((row) => cells(row)[3])).toEqual(['TSLA', 'NVDA', 'AAPL']);
    expect(fixture.componentInstance.sort()).toEqual({ key: 'symbol', direction: 'desc' });

    heading.click();
    fixture.detectChanges();
    expect(rows().map((row) => cells(row)[3])).toEqual(['AAPL', 'NVDA', 'TSLA']);
  });

  it("shows the account in place of the customer on a customer's page", () => {
    render({ showUser: false });

    expect(cells(root().querySelector('.dash-table-head')!)[2]).toBe('Account');
    expect(cells(rows()[0])[2]).toBe('Growth');
  });

  it('opens the order of a row', () => {
    render();
    const opened = vi.fn();
    fixture.componentInstance.opened.subscribe(opened);

    rows()[1].click();
    expect(opened.mock.calls[0][0].orderId).toBe(10481);
  });

  it('knows what each column sorts on', () => {
    const order = orderRow({ price: null });
    expect(orderSortValue(order, 'id')).toBe(10482);
    expect(orderSortValue(order, 'time')).toBe(10482);
    expect(orderSortValue(order, 'user')).toBe('Sean Cheema');
    expect(orderSortValue(order, 'account')).toBe('Growth');
    expect(orderSortValue(order, 'price')).toBe(0);
    expect(orderSortValue(orderRow(), 'price')).toBe(316.59);
    expect(orderSortValue(order, 'quantity')).toBe(4);
    expect(orderSortValue(order, 'status')).toBe('FILLED');
  });
});

describe('OrderDetailComponent', () => {
  let fixture: ComponentFixture<OrderDetailComponent>;
  let load: ReturnType<typeof vi.fn<(orderId: number) => Observable<OrderDetail>>>;
  const root = () => fixture.nativeElement as HTMLElement;

  const render = (detail: Observable<OrderDetail> = of(orderDetail())) => {
    load = vi.fn(() => detail);
    TestBed.configureTestingModule({
      providers: [{ provide: ReportingApiService, useValue: { order: (id: number) => load(id) } }],
    });
    fixture = TestBed.createComponent(OrderDetailComponent);
    fixture.componentRef.setInput('orderId', 10482);
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
  };

  // Label and value of every fact in a section, by its heading.
  const facts = (heading: string) => {
    const section = Array.from(root().querySelectorAll('.section')).find(
      (candidate) => text(candidate.querySelector('h3')!) === heading,
    )!;
    return Object.fromEntries(
      Array.from(section.querySelectorAll('dl > div')).map((fact) => [
        text(fact.querySelector('dt')!),
        text(fact.querySelector('dd')!),
      ]),
    );
  };

  it('heads the dialog with what the order was and what it cost', () => {
    render();

    expect(load).toHaveBeenCalledWith(10482);
    expect(text(root().querySelector('h2')!)).toBe('Order #10482');
    expect(text(root().querySelector('.capitalize')!)).toBe('buy 4 AAPL');
    expect(text(root().querySelector('.text-xs.text-muted-foreground')!)).toMatch(
      /^Apple Inc\. · market order · Oct \d{1,2}, 2026, \d{1,2}:44:12 [AP]M \S+$/,
    );
    expect(text(root().querySelector('.ml-auto')!)).toBe('Cost $1,266.36');
    expect(text(root().querySelector('[role="status"]')!)).toBe(
      'Executed at the market quote; holdings and cash posted.',
    );
  });

  it('shows the customer, the execution, the ledger impact and the references', () => {
    render();

    expect(facts('Customer')).toEqual({
      Name: 'Sean Cheema',
      Email: 'sean@example.com',
      Account: 'Growth',
    });
    const execution = facts('Execution');
    expect(execution['Quantity']).toBe('4');
    expect(execution['Fill price']).toBe('$316.59');
    expect(execution['Fill ID']).toBe('#88482');
    expect(execution['Indicative price']).toBe('$316.50');
    expect(execution['Price buffer']).toBe('1.00%');
    expect(execution['Slippage']).toBe('+$0.09');
    expect(execution['Market time']).toMatch(/^Oct \d{1,2}, /);
    expect(facts('Ledger impact')).toEqual({
      'Cash before': '$6,086.91',
      'Cash change': '-$1,266.36',
      'Cash after': '$4,820.55',
      'AAPL before': '0 sh',
      'Holding change': '+4 sh',
      'AAPL after': '4 sh',
    });
    expect(facts('References')).toEqual({
      'Client reference': '9f1c0a52-9d1e-4b62-8a51-0d6f6f3fa2e4',
      'Order type': 'MARKET',
      'Cash transaction': '#92582',
      'Holding movement': '#95782',
    });
    expect(root().querySelector('dd.text-loss')!.textContent).toContain('-$1,266.36');
    expect(text(root())).not.toContain('Nothing posted');
  });

  it('lists the audit trail in order, colored by what each event means', () => {
    render(
      of(
        orderDetail({
          audit: [
            ...orderDetail().audit,
            { eventType: 'EXECUTION_FAILED', detail: null, recordedAt: '2026-10-08T20:44:13+00:00' },
          ],
        }),
      ),
    );
    const events = Array.from(root().querySelectorAll('ol > li'));

    expect(events.map((event) => text(event.querySelector('.font-medium')!))).toEqual([
      'PENDING',
      'ACCEPTED',
      'FILLED',
      'EXECUTION_FAILED',
    ]);
    expect(events.map((event) => event.querySelector('.rounded-full')!.className.match(/bg-\w+/)![0])).toEqual([
      'bg-primary',
      'bg-primary',
      'bg-gain',
      'bg-loss',
    ]);
    expect(text(events[2])).toContain('· Filled 4 @ 316.59');
    expect(events[0].className).toContain('pb-3.5');
    expect(events[3].className).not.toContain('pb-3.5');
  });

  it('explains a rejection and shows that nothing was posted', () => {
    render(
      of(
        orderDetail({
          status: 'REJECTED',
          price: null,
          fill: null,
          bufferPercent: null,
          userEmail: null,
          rejectionReason: 'BR-09: insufficient funds for this order',
          audit: [],
          ledger: {
            cashBefore: 5000,
            cashChange: null,
            cashAfter: 5000,
            holdingBefore: 0,
            holdingChange: null,
            holdingAfter: 0,
            cashTransactionId: null,
            holdingMovementId: null,
          },
        }),
      ),
    );

    expect(text(root().querySelector('.ml-auto')!)).toBe('Est. value $1,266.00');
    const note = root().querySelector('[role="status"]')!;
    expect(text(note)).toBe(
      'Rejected: insufficient funds for this order. Failed validation; no fill, cash or holdings were posted.',
    );
    expect(note.className).toContain('text-loss');
    expect(text(root())).toContain('Nothing posted');
    expect(facts('Customer')['Email']).toBe('—');
    expect(facts('Execution')).toMatchObject({
      'Fill price': '—',
      'Fill ID': '—',
      'Price buffer': '—',
      Slippage: '—',
    });
    expect(facts('Ledger impact')).toMatchObject({ 'Cash change': '—', 'Holding change': '—' });
    expect(facts('References')).toMatchObject({ 'Cash transaction': '—', 'Holding movement': '—' });
    expect(text(root())).toContain('No audit events were recorded.');
  });

  it('calls a filled sell proceeds and shows the cash coming in', () => {
    render(
      of(
        orderDetail({
          side: 'SELL',
          indicativePrice: null,
          ledger: { ...orderDetail().ledger, cashChange: 1266.36, holdingChange: -4 },
        }),
      ),
    );

    expect(text(root().querySelector('.ml-auto')!)).toBe('Proceeds $1,266.36');
    expect(root().querySelector('dd.text-gain')!.textContent).toContain('+$1,266.36');
    expect(facts('Ledger impact')['Holding change']).toBe('-4 sh');
    expect(facts('Execution')).toMatchObject({ 'Indicative price': '—', Slippage: '—' });
  });

  it('has no value for an order with no price at all', () => {
    render(of(orderDetail({ status: 'PENDING', price: null, indicativePrice: null, fill: null })));

    expect(text(root().querySelector('.ml-auto')!)).toBe('Est. value —');
    expect(text(root().querySelector('[role="status"]')!)).toBe('Submitted and waiting to be validated.');
  });

  it('copies the reference and the order id', () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render();

    const [reference, id] = Array.from(root().querySelectorAll<HTMLButtonElement>('.is-small'));
    reference.click();
    id.click();
    expect(writeText.mock.calls).toEqual([['9f1c0a52-9d1e-4b62-8a51-0d6f6f3fa2e4'], ['10482']]);
  });

  it('shows loading, then an error when the order cannot be read, and closes', () => {
    const pending = new Subject<OrderDetail>();
    render(pending);
    expect(text(root())).toContain('Loading the order…');

    pending.error(new Error('down'));
    fixture.detectChanges();
    expect(text(root().querySelector('[role="alert"]')!)).toBe("We couldn't load this order.");

    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    root().querySelector<HTMLButtonElement>('button[aria-label="Close order detail"]')!.click();
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('reads a rejection reason without its rule number', () => {
    expect(plainReason('BR-09: insufficient funds for this order')).toBe('insufficient funds for this order');
    expect(plainReason('Market closed')).toBe('Market closed');
    expect(plainReason(null)).toBe('');
  });
});

describe('OrdersComponent', () => {
  let fixture: ComponentFixture<OrdersComponent>;
  let load: ReturnType<typeof vi.fn<() => Observable<OrderList>>>;
  let loadOrder: ReturnType<typeof vi.fn<(orderId: number) => Observable<OrderDetail>>>;
  const root = () => fixture.nativeElement as HTMLElement;
  const list = (orders: OrderRow[] = orderRows(), sessionId: number | null = 12): OrderList => ({
    orders,
    total: orders.length,
    sessionId,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    load = vi.fn(() => of(list()));
    loadOrder = vi.fn(() => of(orderDetail()));
  });
  afterEach(() => vi.useRealTimers());

  const render = () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ReportingApiService,
          useValue: { orders: () => load(), order: (id: number) => loadOrder(id) },
        },
      ],
    });
    fixture = TestBed.createComponent(OrdersComponent);
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    fixture.detectChanges();
  };

  const ids = () =>
    Array.from(root().querySelectorAll('app-order-table li > button')).map((row) => cells(row)[0]);
  const counter = () => text(root().querySelector('.ml-auto.self-center')!);
  const choose = (label: string, option: string) => {
    const select = Array.from(root().querySelectorAll('app-filter-select')).find(
      (candidate) => text(candidate.querySelector('.dash-label')!) === label,
    )!;
    select.querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();
    Array.from(select.querySelectorAll<HTMLButtonElement>('[role="option"]'))
      .find((candidate) => text(candidate) === option)!
      .click();
    fixture.detectChanges();
  };
  const search = (query: string) => {
    const input = root().querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = query;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  it('lists every order with the session they belong to', () => {
    render();

    expect(text(root().querySelector('app-page-header')!)).toContain('All accounts · simulation session #12');
    expect(ids()).toEqual(['#10482', '#10481', '#10480']);
    expect(counter()).toBe('3 of 3 orders');
    expect(root().querySelector('.is-plain')).toBeNull();
  });

  it('filters by status, side, asset, customer and fill', () => {
    render();

    choose('Status', 'REJECTED');
    expect(ids()).toEqual(['#10480']);
    expect(counter()).toBe('1 of 3 orders');
    choose('Status', 'All statuses');
    expect(root().querySelector('.is-plain')).toBeNull();

    choose('Side', 'Sell');
    expect(ids()).toEqual(['#10481']);
    choose('Side', 'Buy & sell');

    choose('Asset', 'AAPL');
    expect(ids()).toEqual(['#10482']);
    choose('Asset', 'All assets');

    choose('Customer', 'Marcus Lee');
    expect(ids()).toEqual(['#10480']);
    choose('Customer', 'All customers');

    choose('Fill', 'Has fill price');
    expect(ids()).toEqual(['#10482', '#10481']);
    choose('Fill', 'No fill yet');
    expect(ids()).toEqual(['#10480']);
  });

  it('searches customer, symbol, order number and reference, and clears every filter at once', () => {
    render();

    search('priya');
    expect(ids()).toEqual(['#10481']);
    search('TSLA');
    expect(ids()).toEqual(['#10480']);
    search('10482');
    expect(ids()).toEqual(['#10482']);
    search('c3e90a52');
    expect(ids()).toEqual(['#10480']);

    search('nobody');
    expect(text(root())).toContain('No orders match these filters.');
    expect(root().querySelector('app-order-table')).toBeNull();

    root().querySelector<HTMLButtonElement>('.is-plain')!.click();
    fixture.detectChanges();
    expect(ids()).toHaveLength(3);
    expect(root().querySelector<HTMLInputElement>('input[type="search"]')!.value).toBe('');
  });

  it('opens an order from its row and closes it again', () => {
    render();

    root().querySelector<HTMLButtonElement>('app-order-table li > button')!.click();
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
    expect(loadOrder).toHaveBeenCalledWith(10482);
    expect(root().querySelector('app-order-detail')).not.toBeNull();

    root().querySelector<HTMLButtonElement>('button[aria-label="Close order detail"]')!.click();
    fixture.detectChanges();
    expect(root().querySelector('app-order-detail')).toBeNull();
  });

  it('exports the rows on screen as csv', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const blobs: Blob[] = [];
    URL.createObjectURL = ((blob: Blob) => (blobs.push(blob), 'blob:csv')) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    render();
    choose('Side', 'Buy');

    root().querySelector<HTMLButtonElement>('app-export-menu button')!.click();
    fixture.detectChanges();
    root().querySelector<HTMLButtonElement>('[role="menuitem"]')!.click();

    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('orders.csv');
    const csv = await blobs[0].text();
    expect(csv.split('\n')).toHaveLength(3);
    expect(csv).toContain('"10482"');
    expect(csv).toContain('"10480","2026-10-08T20:42:31+00:00","Marcus Lee","Swing","TSLA","BUY","40","MARKET","","REJECTED"');
    click.mockRestore();
  });

  it('says so when no order has been placed, and leaves the session out when there is none', () => {
    load.mockReturnValue(of(list([], null)));
    render();

    expect(text(root())).toContain('No orders have been placed yet.');
    expect(text(root().querySelector('app-page-header p')!)).toBe('All accounts');
    expect(counter()).toBe('0 of 0 orders');
  });

  it('reads the orders again on its own', () => {
    render();
    vi.advanceTimersByTime(ORDERS_REFRESH_MS);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('shows loading, then offers a retry when the orders cannot be read', () => {
    load.mockReturnValue(throwError(() => new Error('down')));
    TestBed.configureTestingModule({
      providers: [{ provide: ReportingApiService, useValue: { orders: () => load() } }],
    });
    fixture = TestBed.createComponent(OrdersComponent);
    fixture.detectChanges();
    expect(text(root())).toContain('Loading orders…');

    vi.advanceTimersByTime(0);
    fixture.detectChanges();
    expect(text(root().querySelector('[role="alert"]')!)).toContain("We couldn't load the orders.");

    load.mockReturnValue(of(list()));
    root().querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    fixture.detectChanges();
    expect(ids()).toHaveLength(3);
  });
});
