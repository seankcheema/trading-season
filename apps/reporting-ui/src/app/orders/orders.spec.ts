import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import {
  orderDetail,
  orderRow,
  orderRows,
  transferRow,
  transferRows,
} from '../../testing/console-fixtures';
import { cells, text } from '../../testing/dom';
import { OrderDetail, OrderList, OrderRow, TransferRow } from '../reporting/console.models';
import { ReportingApiService } from '../reporting/reporting-api.service';
import { ledgerRows, ledgerSortValue } from './ledger-rows';
import { OrderBrowserComponent } from './order-browser.component';
import { COPIED_NOTE_MS, OrderDetailComponent, plainReason } from './order-detail.component';
import { OrderTableComponent } from './order-table.component';
import { ORDERS_REFRESH_MS, OrdersComponent } from './orders.component';

// What a table line is: its order number, or for a transfer what kind it is.
const line = (row: Element) => (cells(row)[0] === '—' ? cells(row)[4] : cells(row)[0]);

describe('ledger rows', () => {
  it('makes one line of each order and each transfer', () => {
    const [order, unfilled, deposit, withdrawal] = ledgerRows(
      [orderRow(), orderRow({ orderId: 7, price: null })],
      transferRows(),
    );

    expect(order).toMatchObject({
      key: 'order-10482',
      id: 10482,
      at: '2026-10-08T20:44:12+00:00',
      symbol: 'AAPL',
      side: 'BUY',
      quantity: 4,
      price: 316.59,
      amount: 1266.36,
      status: 'FILLED',
      reference: '9f1c0a52-9d1e-4b62-8a51-0d6f6f3fa2e4',
    });
    expect(order.order).toEqual(orderRow());
    expect(unfilled.amount).toBeNull();
    expect(deposit).toEqual({
      key: 'transfer-92590',
      order: null,
      id: 92590,
      at: '2026-10-08T20:43:00+00:00',
      userName: 'Sean Cheema',
      accountName: 'Growth',
      symbol: 'Cash',
      side: 'DEPOSIT',
      quantity: null,
      price: null,
      amount: 2500,
      status: 'COMPLETED',
      reference: '',
    });
    // A withdrawal is stored negative and shown as what moved.
    expect(withdrawal).toMatchObject({ side: 'WITHDRAWAL', amount: 800 });
  });

  it('knows what each column sorts on', () => {
    const [order, unfilled, deposit] = ledgerRows(
      [orderRow(), orderRow({ price: null })],
      [transferRow()],
    );

    expect(ledgerSortValue(order, 'id')).toBe(10482);
    expect(ledgerSortValue(deposit, 'id')).toBe(0);
    expect(ledgerSortValue(order, 'time')).toBe(Date.parse('2026-10-08T20:44:12+00:00'));
    expect(ledgerSortValue(order, 'user')).toBe('Sean Cheema');
    expect(ledgerSortValue(order, 'account')).toBe('Growth');
    expect(ledgerSortValue(order, 'symbol')).toBe('AAPL');
    expect(ledgerSortValue(deposit, 'side')).toBe('DEPOSIT');
    expect(ledgerSortValue(order, 'quantity')).toBe(4);
    expect(ledgerSortValue(deposit, 'quantity')).toBe(0);
    expect(ledgerSortValue(order, 'price')).toBe(316.59);
    expect(ledgerSortValue(unfilled, 'price')).toBe(0);
    expect(ledgerSortValue(unfilled, 'amount')).toBe(0);
    expect(ledgerSortValue(deposit, 'amount')).toBe(2500);
    expect(ledgerSortValue(order, 'status')).toBe('FILLED');
  });
});

describe('OrderTableComponent', () => {
  let fixture: ComponentFixture<OrderTableComponent>;
  const root = () => fixture.nativeElement as HTMLElement;
  // Every line, and the ones that open an order.
  const lines = () => Array.from(root().querySelectorAll<HTMLElement>('li > *'));
  const rows = () => Array.from(root().querySelectorAll<HTMLButtonElement>('li > button'));

  const render = (inputs: Record<string, unknown> = {}) => {
    fixture = TestBed.createComponent(OrderTableComponent);
    fixture.componentRef.setInput('rows', ledgerRows(orderRows(), transferRows()));
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
  };

  it('lists orders and transfers newest first with who placed them', () => {
    render();

    expect(cells(root().querySelector('.dash-table-head')!)).toEqual([
      'Order',
      'Time',
      'Customer',
      'Asset',
      'Side',
      'Qty',
      'Fill price',
      'Amount',
      'Status',
    ]);
    expect(lines().map(line)).toEqual(['#10482', '#10481', 'deposit', '#10480', 'withdrawal']);
    const [id, time, customer, asset, side, quantity, price, amount, status] = cells(rows()[0]);
    expect([id, customer, asset, side, quantity, price, amount, status]).toEqual([
      '#10482',
      'Sean Cheema · Growth',
      'AAPL',
      'buy',
      '4',
      '$316.59',
      '$1,266.36',
      'filled',
    ]);
    expect(time).toMatch(/^Oct \d{1,2}, \d{1,2}:44:12 [AP]M$/);
    // Named by what the row shows, so the visible text is in the name (WCAG 2.5.3); the
    // popup says what activating it does.
    expect(rows()[0].hasAttribute('aria-label')).toBe(false);
    expect(rows()[0].getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('shows a deposit and a withdrawal as cash that moved, with nothing to open', () => {
    render();
    const [deposit, withdrawal] = Array.from(root().querySelectorAll<HTMLElement>('[data-transfer]'));

    expect(deposit.tagName).toBe('DIV');
    const [id, time, customer, ...rest] = cells(deposit);
    expect([id, customer, ...rest]).toEqual([
      '—',
      'Sean Cheema · Growth',
      'Cash',
      'deposit',
      '—',
      '—',
      '$2,500.00',
      'completed',
    ]);
    expect(time).toMatch(/^Oct \d{1,2}, \d{1,2}:43:00 [AP]M$/);
    expect(cells(withdrawal).slice(3)).toEqual(['Cash', 'withdrawal', '—', '—', '$800.00', 'completed']);
    const tones = (row: Element) =>
      Array.from(row.querySelectorAll('app-change-pill')).map((pill) => pill.className);
    expect(tones(deposit)[0]).toContain('text-gain');
    expect(tones(deposit)[1]).toContain('text-gain');
    expect(tones(withdrawal)[0]).toContain('text-muted-foreground');
  });

  it('colors a sell and a rejection, and dashes a missing fill price and amount', () => {
    render();

    expect(rows()[0].querySelectorAll('app-change-pill')[0].className).toContain('text-primary');
    expect(rows()[1].querySelectorAll('app-change-pill')[0].className).toContain('text-loss');
    expect(rows()[2].querySelectorAll('app-change-pill')[1].className).toContain('text-loss');
    expect(cells(rows()[2]).slice(6, 8)).toEqual(['—', '—']);
  });

  it('sorts by a column heading and flips on the second click', () => {
    render();
    const heading = root().querySelector<HTMLButtonElement>('button[aria-label="Sort by Asset"]')!;

    heading.click();
    fixture.detectChanges();
    expect(lines().map((row) => cells(row)[3])).toEqual(['TSLA', 'NVDA', 'Cash', 'Cash', 'AAPL']);
    expect(fixture.componentInstance.sort()).toEqual({ key: 'symbol', direction: 'desc' });

    heading.click();
    fixture.detectChanges();
    expect(lines().map((row) => cells(row)[3])).toEqual(['AAPL', 'Cash', 'Cash', 'NVDA', 'TSLA']);
  });

  it('keeps the transfers after the orders when sorted by order number', () => {
    render();

    root().querySelector<HTMLButtonElement>('button[aria-label="Sort by Order"]')!.click();
    fixture.detectChanges();
    expect(lines().map((row) => cells(row)[0])).toEqual(['#10482', '#10481', '#10480', '—', '—']);
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
    root().querySelector<HTMLElement>('[data-transfer]')!.click();
    expect(opened).toHaveBeenCalledTimes(1);
    expect(opened.mock.calls[0][0].orderId).toBe(10481);
  });
});

describe('OrderBrowserComponent', () => {
  let fixture: ComponentFixture<OrderBrowserComponent>;
  const root = () => fixture.nativeElement as HTMLElement;

  const render = (inputs: Record<string, unknown> = {}) => {
    fixture = TestBed.createComponent(OrderBrowserComponent);
    fixture.componentRef.setInput('orders', orderRows());
    fixture.componentRef.setInput('transfers', transferRows());
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
  };

  const shown = () => Array.from(root().querySelectorAll('app-order-table li > *')).map(line);
  const counter = () => text(root().querySelector('[data-count]')!);
  const captions = () =>
    Array.from(root().querySelectorAll('app-filter-select .dash-label')).map(text);
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

  it('lists the orders with the transfers among them, newest first', () => {
    render();

    expect(shown()).toEqual(['#10482', '#10481', 'deposit', '#10480', 'withdrawal']);
    expect(counter()).toBe('5 of 5 rows');
    expect(captions()).toEqual(['Status', 'Side', 'Asset', 'Customer', 'Fill']);
    expect(root().querySelector<HTMLInputElement>('input[type="search"]')!.placeholder).toBe(
      'Customer, symbol, order # or ref',
    );
    expect(root().querySelector('.is-plain')).toBeNull();
  });

  it('filters by status, side, asset, customer and fill', () => {
    render();

    choose('Status', 'REJECTED');
    expect(shown()).toEqual(['#10480']);
    expect(counter()).toBe('1 of 5 rows');
    choose('Status', 'COMPLETED');
    expect(shown()).toEqual(['deposit', 'withdrawal']);
    choose('Status', 'All statuses');
    expect(root().querySelector('.is-plain')).toBeNull();

    choose('Side', 'Sell');
    expect(shown()).toEqual(['#10481']);
    choose('Side', 'Deposit');
    expect(shown()).toEqual(['deposit']);
    choose('Side', 'Withdrawal');
    expect(shown()).toEqual(['withdrawal']);
    choose('Side', 'All sides');

    choose('Asset', 'AAPL');
    expect(shown()).toEqual(['#10482']);
    choose('Asset', 'Cash');
    expect(shown()).toEqual(['deposit', 'withdrawal']);
    choose('Asset', 'All assets');

    choose('Customer', 'Marcus Lee');
    expect(shown()).toEqual(['#10480']);
    choose('Customer', 'Priya Natarajan');
    expect(shown()).toEqual(['#10481', 'withdrawal']);
    choose('Customer', 'All customers');

    // Only an order can fill, so either choice leaves the transfers out.
    choose('Fill', 'Has fill price');
    expect(shown()).toEqual(['#10482', '#10481']);
    choose('Fill', 'No fill yet');
    expect(shown()).toEqual(['#10480']);
  });

  it('searches customer, symbol, order number, reference and kind, and clears every filter at once', () => {
    render();

    search('priya');
    expect(shown()).toEqual(['#10481', 'withdrawal']);
    search('TSLA');
    expect(shown()).toEqual(['#10480']);
    search('10482');
    expect(shown()).toEqual(['#10482']);
    search('c3e90a52');
    expect(shown()).toEqual(['#10480']);
    search('deposit');
    expect(shown()).toEqual(['deposit']);
    // A transfer is not found by its cash transaction number, which the table does not show.
    search('92590');
    expect(text(root())).toContain('No orders or transfers match these filters.');
    expect(root().querySelector('app-order-table')).toBeNull();
    expect(counter()).toBe('0 of 5 rows');

    root().querySelector<HTMLButtonElement>('.is-plain')!.click();
    fixture.detectChanges();
    expect(shown()).toHaveLength(5);
    expect(root().querySelector<HTMLInputElement>('input[type="search"]')!.value).toBe('');
  });

  it("tells a customer's rows apart by account", () => {
    render({ showUser: false });

    expect(captions()).toEqual(['Status', 'Side', 'Asset', 'Account', 'Fill']);
    expect(root().querySelector<HTMLInputElement>('input[type="search"]')!.placeholder).toBe(
      'Account, symbol, order # or ref',
    );
    expect(cells(root().querySelector('.dash-table-head')!)[2]).toBe('Account');

    choose('Account', 'Core');
    expect(shown()).toEqual(['#10481', 'withdrawal']);
    choose('Account', 'All accounts');
    search('swing');
    expect(shown()).toEqual(['#10480']);
  });

  it('hands over the rows on screen in the order they are shown', () => {
    render();
    choose('Side', 'Buy');
    root().querySelector<HTMLButtonElement>('button[aria-label="Sort by Qty"]')!.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.shown().map((row) => row.id)).toEqual([10480, 10482]);
  });

  it('passes on the order a row opens', () => {
    render();
    const opened = vi.fn();
    fixture.componentInstance.opened.subscribe(opened);

    root().querySelector<HTMLButtonElement>('app-order-table li > button')!.click();
    expect(opened.mock.calls[0][0].orderId).toBe(10482);
  });

  it('says so, without filters, when there is nothing to filter', () => {
    render({ orders: [], transfers: [] });
    expect(text(root())).toBe('No orders have been placed yet.');
    expect(root().querySelector('input')).toBeNull();

    render({ orders: [], transfers: [], emptyMessage: "This customer hasn't placed any orders yet." });
    expect(text(root())).toBe("This customer hasn't placed any orders yet.");
  });

  it('lists transfers alone for someone who has only moved cash', () => {
    render({ orders: [] });
    expect(shown()).toEqual(['deposit', 'withdrawal']);
    expect(counter()).toBe('2 of 2 rows');
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

  it('puts the references under the audit trail, beside the rest', () => {
    render();
    const [left, right] = Array.from(root().querySelectorAll('.grid.gap-3 > div'));
    const headings = (column: Element) => Array.from(column.querySelectorAll('h3')).map(text);

    expect(headings(left)).toEqual(['Customer', 'Execution', 'Ledger impact']);
    expect(headings(right)).toEqual(['Audit trail', 'References']);
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
    expect(facts('References')).toMatchObject({
      'Order type': 'MARKET',
      'Cash transaction': '#92582',
      'Holding movement': '#95782',
    });
    // The reference is shown whole, on a row of its own, where it can be selected.
    const reference = root().querySelector('[data-reference]')!;
    expect(text(reference)).toBe('9f1c0a52-9d1e-4b62-8a51-0d6f6f3fa2e4');
    expect(reference.className).toContain('select-all');
    expect(reference.className).not.toContain('truncate');
    expect(root().querySelector('dd.text-loss')!.textContent).toContain('-$1,266.36');
    expect(text(root())).not.toContain('Nothing posted');
  });

  it('labels each stage price by the quote it came from', () => {
    render(
      of(
        orderDetail({
          audit: [
            { eventType: 'PENDING', detail: null, recordedAt: '2026-10-08T20:44:10+00:00', price: 101, priceKind: 'REFERENCE' },
            { eventType: 'TRIGGERED', detail: null, recordedAt: '2026-10-08T20:44:11+00:00', price: 104, priceKind: 'TRIGGER' },
            { eventType: 'FILLED', detail: null, recordedAt: '2026-10-08T20:44:12+00:00', price: 104.5, priceKind: 'FILL' },
          ],
        }),
      ),
    );
    const prices = Array.from(root().querySelectorAll('[data-stage-price]')).map((price) => text(price));
    expect(prices).toEqual(['$101.00 market quote', '$104.00 trigger quote', '$104.50 fill price']);
  });

  it('lists the audit trail in order, colored by what each event means', () => {
    render(
      of(
        orderDetail({
          audit: [
            ...orderDetail().audit,
            {
              eventType: 'EXECUTION_FAILED',
              detail: null,
              recordedAt: '2026-10-08T20:44:13+00:00',
              price: null,
              priceKind: null,
            },
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
      'bg-pending',
      'bg-primary',
      'bg-gain',
      'bg-loss',
    ]);
    expect(text(events[2])).toContain('· Filled 4 @ 316.59');
    // Each stage shows the price the order stood at; one recorded without a price shows none.
    const stagePrice = (event: Element) => {
      const price = event.querySelector('[data-stage-price]');
      return price ? text(price) : '';
    };
    expect(events.map(stagePrice)).toEqual([
      '$316.50 indicative',
      '$316.50 indicative',
      '$316.59 fill price',
      '',
    ]);
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

  it('copies the reference and the order id, and says so for a moment', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render();
    const reference = root().querySelector<HTMLButtonElement>('button[aria-label="Copy client reference"]')!;
    const id = Array.from(root().querySelectorAll<HTMLButtonElement>('.is-small'))[1];
    const settle = async (ms = 0) => {
      await vi.advanceTimersByTimeAsync(ms);
      fixture.detectChanges();
    };
    expect([text(reference), text(id)]).toEqual(['Copy', 'Copy order ID']);

    reference.click();
    await settle();
    expect(writeText).toHaveBeenLastCalledWith('9f1c0a52-9d1e-4b62-8a51-0d6f6f3fa2e4');
    expect([text(reference), text(id)]).toEqual(['Copied', 'Copy order ID']);
    expect(text(root().querySelector('[aria-live]')!)).toBe('Copied to the clipboard');

    // Copying the other id moves the note, and its two seconds start again.
    await settle(COPIED_NOTE_MS - 1);
    id.click();
    await settle();
    expect(writeText).toHaveBeenLastCalledWith('10482');
    expect([text(reference), text(id)]).toEqual(['Copy', 'Copied']);
    await settle(COPIED_NOTE_MS - 1);
    expect(text(id)).toBe('Copied');
    await settle(1);
    expect(text(id)).toBe('Copy order ID');
    expect(text(root().querySelector('[aria-live]')!)).toBe('');
    vi.useRealTimers();
  });

  it('does not claim a copy the browser refused', async () => {
    const writeText = vi.fn(() => Promise.reject(new Error('denied')));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render();
    const reference = root().querySelector<HTMLButtonElement>('button[aria-label="Copy client reference"]')!;

    reference.click();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    expect(text(reference)).toBe('Copy');
  });

  it('shows loading, then an error when the order cannot be read, and closes', () => {
    const pending = new Subject<OrderDetail>();
    render(pending);
    expect(text(root().querySelector('[role="status"]')!)).toBe('Loading the order…');
    // The dialog's shape stands in for it: three sections on the left, two on the right.
    const skeleton = root().querySelector('[data-skeleton]')!;
    expect(skeleton.getAttribute('aria-busy')).toBe('true');
    expect(
      Array.from(skeleton.querySelectorAll('app-skeleton-facts')).map((facts) => facts.children.length),
    ).toEqual([3, 9, 6, 4, 4]);

    pending.error(new Error('down'));
    fixture.detectChanges();
    expect(text(root().querySelector('[role="alert"]')!)).toBe("We couldn't load this order.");
    expect(root().querySelector('.skeleton')).toBeNull();

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
  const list = (
    orders: OrderRow[] = orderRows(),
    sessionId: number | null = 12,
    transfers: TransferRow[] = transferRows(),
  ): OrderList => ({ orders, transfers, total: orders.length, sessionId });

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

  const shown = () => Array.from(root().querySelectorAll('app-order-table li > *')).map(line);
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
  const exportCsv = async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const blobs: Blob[] = [];
    URL.createObjectURL = ((blob: Blob) => (blobs.push(blob), 'blob:csv')) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();

    root().querySelector<HTMLButtonElement>('app-export-menu button')!.click();
    fixture.detectChanges();
    root().querySelector<HTMLButtonElement>('[role="menuitem"]')!.click();

    const name = (click.mock.contexts[0] as HTMLAnchorElement).download;
    click.mockRestore();
    return { name, lines: (await blobs[0].text()).split('\n') };
  };

  it('lists every order and transfer with the session they belong to', () => {
    render();

    expect(text(root().querySelector('app-page-header')!)).toContain('All accounts · simulation session #12');
    expect(shown()).toEqual(['#10482', '#10481', 'deposit', '#10480', 'withdrawal']);
    expect(text(root().querySelector('[data-count]')!)).toBe('5 of 5 rows');
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
    render();
    choose('Side', 'Buy');

    const { name, lines } = await exportCsv();

    expect(name).toBe('orders.csv');
    expect(lines).toEqual([
      '"Order","Time","Customer","Account","Asset","Side","Qty","Fill price","Amount","Status","Client reference"',
      '"10482","2026-10-08T20:44:12+00:00","Sean Cheema","Growth","AAPL","BUY","4","316.59","1266.36","FILLED","9f1c0a52-9d1e-4b62-8a51-0d6f6f3fa2e4"',
      '"10480","2026-10-08T20:42:31+00:00","Marcus Lee","Swing","TSLA","BUY","40","","","REJECTED","c3e90a52-9d1e-4b62-8a51-0d6f6f3f04b1"',
    ]);
  });

  it('exports a transfer with its amount and no order number', async () => {
    render();
    choose('Side', 'Withdrawal');

    const { lines } = await exportCsv();

    expect(lines[1]).toBe(
      '"","2026-10-08T20:12:00+00:00","Priya Natarajan","Core","Cash","WITHDRAWAL","","","800","COMPLETED",""',
    );
  });

  it('exports only the heading before the orders have loaded', async () => {
    load.mockReturnValue(new Subject<OrderList>());
    render();

    expect((await exportCsv()).lines).toHaveLength(1);
  });

  it('says so when no order has been placed, and leaves the session out when there is none', () => {
    load.mockReturnValue(of(list([], null, [])));
    render();

    expect(text(root().querySelector('section')!)).toBe('No orders have been placed yet.');
    expect(text(root().querySelector('app-page-header p')!)).toBe('All accounts');
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
    const card = root().querySelector('section.dash-card')!;
    expect(text(card.querySelector('[role="status"]')!)).toBe('Loading orders…');
    // A table's shape stands in for it: the search, the five filters and rows on the nine columns.
    expect(card.getAttribute('aria-busy')).toBe('true');
    expect(card.querySelectorAll('app-skeleton-table [data-filter]')).toHaveLength(5);
    expect(card.querySelector('app-skeleton-table [data-row]')!.children).toHaveLength(9);

    vi.advanceTimersByTime(0);
    fixture.detectChanges();
    expect(text(root().querySelector('[role="alert"]')!)).toContain("We couldn't load the orders.");
    expect(card.getAttribute('aria-busy')).toBeNull();
    expect(root().querySelector('.skeleton')).toBeNull();

    load.mockReturnValue(of(list()));
    root().querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    fixture.detectChanges();
    expect(shown()).toHaveLength(5);
  });
});
