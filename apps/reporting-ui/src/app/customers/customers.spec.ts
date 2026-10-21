import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import {
  customer,
  customerDetail,
  customers,
  orderDetail,
  orderRows,
  transferRows,
} from '../../testing/console-fixtures';
import { cells, text } from '../../testing/dom';
import { CustomerDetail, CustomerList, OrderDetail } from '../reporting/console.models';
import { ReportingApiService } from '../reporting/reporting-api.service';
import { CUSTOMER_REFRESH_MS, CustomerDetailComponent } from './customer-detail.component';
import { CUSTOMERS_REFRESH_MS, CustomersComponent, initials, titleCase } from './customers.component';

describe('customer helpers', () => {
  it('makes initials from a name or from an email', () => {
    expect(initials('Sean Cheema')).toBe('SC');
    expect(initials('newcomer@example.com')).toBe('NE');
    expect(initials('Cher')).toBe('C');
    expect(initials('')).toBe('?');
  });

  it('writes a level the way the product does', () => {
    expect(titleCase('BEGINNER')).toBe('Beginner');
    expect(titleCase(null)).toBe('—');
  });
});

describe('CustomersComponent', () => {
  let fixture: ComponentFixture<CustomersComponent>;
  let load: ReturnType<typeof vi.fn<() => Observable<CustomerList>>>;
  const root = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    load = vi.fn(() => of({ customers: customers() }));
  });
  afterEach(() => vi.useRealTimers());

  const create = () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ReportingApiService, useValue: { customers: () => load() } },
      ],
    });
    fixture = TestBed.createComponent(CustomersComponent);
    fixture.detectChanges();
  };
  const render = () => {
    create();
    vi.advanceTimersByTime(0);
    fixture.detectChanges();
  };

  const rows = () => Array.from(root().querySelectorAll<HTMLElement>('[role="rowgroup"] > [role="row"]'));
  const names = () => rows().map((row) => text(row.querySelector('.font-medium')!));
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

  it('lists every trader, most recently active first', () => {
    render();

    expect(names()).toEqual(['Sean Cheema', 'Jane Doe', 'newcomer@example.com']);
    expect(counter()).toBe('3 of 3 customers');
    const [who, status, accounts, cash, portfolio, failed, last] = cells(rows()[0]);
    expect([who, status, accounts, cash, portfolio, failed]).toEqual([
      'SC Sean Cheema sean@example.com',
      'active',
      '2',
      '$4,820.55',
      '$28,985.08',
      '0',
    ]);
    expect(last).not.toBe('—');
    expect(rows()[0].querySelector('a')!.getAttribute('href')).toBe('/customers/6f1c0a52-9d1e-4b62-8a51-0d6f6f3f6f10');
    expect(cells(rows()[2])[6]).toBe('—');
  });

  it('marks a locked account and a run of failed sign-ins', () => {
    render();
    const jane = rows()[1];

    expect(jane.querySelector('app-change-pill')!.className).toContain('text-loss');
    expect(jane.children[5].className).toContain('text-loss');
    expect(rows()[0].children[5].className).not.toContain('text-loss');
  });

  it('filters by status, level and flag, and not by role, since every customer is a trader', () => {
    render();
    expect(Array.from(root().querySelectorAll('app-filter-select .dash-label')).map(text)).toEqual([
      'Status',
      'Trader level',
      'Flags',
    ]);

    choose('Status', 'LOCKED');
    expect(names()).toEqual(['Jane Doe']);
    expect(counter()).toBe('1 of 3 customers');
    choose('Status', 'All statuses');

    choose('Trader level', 'Advanced');
    expect(names()).toEqual(['Sean Cheema']);
    choose('Trader level', 'All levels');

    choose('Flags', 'Failed sign-ins');
    expect(names()).toEqual(['Jane Doe']);
    choose('Flags', 'No cash');
    expect(names()).toEqual(['Jane Doe', 'newcomer@example.com']);
    choose('Flags', 'No accounts');
    expect(names()).toEqual(['newcomer@example.com']);
    choose('Flags', 'No flag filter');
    expect(root().querySelector('.is-plain')).toBeNull();
  });

  it('searches name, email and user id, and clears every filter at once', () => {
    render();

    search('jane.doe@');
    expect(names()).toEqual(['Jane Doe']);
    search('3b5f0a52');
    expect(names()).toEqual(['newcomer@example.com']);
    search('nobody');
    expect(text(root())).toContain('No customers match these filters.');

    root().querySelector<HTMLButtonElement>('.is-plain')!.click();
    fixture.detectChanges();
    expect(names()).toHaveLength(3);
  });

  it('sorts by a column heading and flips on the second click', () => {
    render();
    const heading = root().querySelector<HTMLButtonElement>('button[aria-label="Sort by Failed sign-ins"]')!;

    heading.click();
    fixture.detectChanges();
    expect(names()[0]).toBe('Jane Doe');

    root().querySelector<HTMLButtonElement>('button[aria-label="Sort by Customer"]')!.click();
    fixture.detectChanges();
    expect(names()).toEqual(['Sean Cheema', 'newcomer@example.com', 'Jane Doe']);
    root().querySelector<HTMLButtonElement>('button[aria-label="Sort by Customer"]')!.click();
    fixture.detectChanges();
    expect(names()).toEqual(['Jane Doe', 'newcomer@example.com', 'Sean Cheema']);
  });

  it('exports the rows on screen as csv', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const blobs: Blob[] = [];
    URL.createObjectURL = ((blob: Blob) => (blobs.push(blob), 'blob:csv')) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    render();
    choose('Status', 'LOCKED');

    root().querySelector<HTMLButtonElement>('app-export-menu button')!.click();
    fixture.detectChanges();
    root().querySelector<HTMLButtonElement>('[role="menuitem"]')!.click();

    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('customers.csv');
    const csv = await blobs[0].text();
    expect(csv.split('\n')).toHaveLength(2);
    expect(csv.split('\n')[0]).not.toContain('Role');
    expect(csv).toContain('"Jane Doe","jane.doe@example.com","LOCKED","BEGINNER","1","0","0","5"');
    click.mockRestore();
  });

  it('reads the customers again on its own', () => {
    render();
    vi.advanceTimersByTime(CUSTOMERS_REFRESH_MS);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('shows loading, then offers a retry when the customers cannot be read', () => {
    load.mockReturnValue(throwError(() => new Error('down')));
    create();
    const card = root().querySelector('section.dash-card')!;
    expect(text(card.querySelector('[role="status"]')!)).toBe('Loading customers…');
    // A table's shape stands in for it: the search, the three filters and rows on the seven columns.
    expect(card.getAttribute('aria-busy')).toBe('true');
    expect(card.querySelectorAll('app-skeleton-table [data-filter]')).toHaveLength(3);
    expect(card.querySelector('app-skeleton-table [data-row]')!.children).toHaveLength(7);

    vi.advanceTimersByTime(0);
    fixture.detectChanges();
    expect(text(root().querySelector('[role="alert"]')!)).toContain("We couldn't load the customers.");
    expect(card.getAttribute('aria-busy')).toBeNull();
    expect(root().querySelector('.skeleton')).toBeNull();

    load.mockReturnValue(of({ customers: customers() }));
    root().querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    fixture.detectChanges();
    expect(names()).toHaveLength(3);
  });
});

describe('CustomerDetailComponent', () => {
  let fixture: ComponentFixture<CustomerDetailComponent>;
  let load: ReturnType<typeof vi.fn<(userId: string) => Observable<CustomerDetail>>>;
  let loadOrder: ReturnType<typeof vi.fn<(orderId: number) => Observable<OrderDetail>>>;
  const root = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    load = vi.fn(() => of(customerDetail()));
    loadOrder = vi.fn(() => of(orderDetail()));
  });
  afterEach(() => vi.useRealTimers());

  const create = () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ReportingApiService,
          useValue: { customer: (id: string) => load(id), order: (id: number) => loadOrder(id) },
        },
      ],
    });
    fixture = TestBed.createComponent(CustomerDetailComponent);
    fixture.componentRef.setInput('userId', customer().userId);
    fixture.detectChanges();
  };
  // The first load waits for the timer, then for the route's id.
  const settle = () => {
    vi.advanceTimersByTime(0);
    TestBed.tick();
    fixture.detectChanges();
  };
  const render = () => {
    create();
    settle();
  };

  const card = (heading: string) =>
    Array.from(root().querySelectorAll('section')).find(
      (section) => text(section.querySelector('h2')!) === heading,
    )!;
  const facts = (heading: string) =>
    Object.fromEntries(
      Array.from(card(heading).querySelectorAll('dl > div')).map((fact) => [
        text(fact.querySelector('dt')!),
        text(fact.querySelector('dd')!),
      ]),
    );

  it('heads the page with who the customer is', () => {
    render();

    expect(load).toHaveBeenCalledWith('6f1c0a52-9d1e-4b62-8a51-0d6f6f3f6f10');
    expect(text(root().querySelector('h1')!)).toBe('Sean Cheema');
    expect(text(root().querySelector('header app-change-pill')!)).toBe('active');
    expect(text(root().querySelector('header p')!)).toBe(
      'sean@example.com · 6f1c0a52-9d1e-4b62-8a51-0d6f6f3f6f10 · trader',
    );
    const back = root().querySelector<HTMLAnchorElement>('a[aria-label="Back to customers"]')!;
    expect(back.getAttribute('href')).toBe('/customers');
    expect(root().querySelector('[role="status"]')).toBeNull();
  });

  it('shows the profile, the sign-in security and the balances', () => {
    render();

    const profile = facts('Profile');
    expect(profile['Trader level']).toBe('Advanced');
    expect(profile['Role']).toBe('TRADER');
    expect(profile['Member since']).toMatch(/^Jan \d, 2026$/);
    expect(facts('Security')).toMatchObject({
      'Account status': 'ACTIVE',
      'Failed attempts': '0',
      'Locked until': '—',
      'Idle timeout': '15 minutes',
    });
    expect(card('Security').querySelector('.text-loss')).toBeNull();
    const balance = card('Total balance');
    expect(text(balance.querySelector('p')!)).toBe('$33,806');
    expect(Array.from(balance.querySelectorAll('li')).map(text)).toEqual([
      'Cash (shared) $4,820.55',
      'Growth $7,604.68',
      'Retirement $21,380.40',
    ]);
  });

  it('says when a locked account unlocks, without offering to unlock it', () => {
    load.mockReturnValue(
      of(
        customerDetail({
          status: 'LOCKED',
          failedAttempts: 5,
          lockedUntil: '2026-10-08T21:15:00+00:00',
        }),
      ),
    );
    render();

    const banner = root().querySelector('[role="status"]')!;
    expect(text(banner)).toMatch(
      /^Account locked after 5 failed sign-in attempts\. Unlocks automatically Oct \d{1,2}, \d{1,2}:15 [AP]M\.$/,
    );
    expect(banner.querySelector('button')).toBeNull();
    expect(Array.from(card('Security').querySelectorAll('.text-loss')).map(text)).toEqual([
      'LOCKED',
      '5',
    ]);
  });

  it("searches and filters the customer's orders and transfers", () => {
    load.mockReturnValue(of(customerDetail({ orders: orderRows(), transfers: transferRows() })));
    render();
    const orders = card('Orders');
    const assets = () =>
      Array.from(orders.querySelectorAll('app-order-table [role="rowgroup"] > [role="row"]')).map((row) => cells(row)[3]);
    const choose = (label: string, option: string) => {
      const select = Array.from(orders.querySelectorAll('app-filter-select')).find(
        (candidate) => text(candidate.querySelector('.dash-label')!) === label,
      )!;
      select.querySelector<HTMLButtonElement>('button')!.click();
      fixture.detectChanges();
      Array.from(select.querySelectorAll<HTMLButtonElement>('[role="option"]'))
        .find((candidate) => text(candidate) === option)!
        .click();
      fixture.detectChanges();
    };

    expect(assets()).toEqual(['AAPL', 'NVDA', 'Cash', 'TSLA', 'Cash']);
    expect(text(orders.querySelector('[data-count]')!)).toBe('5 of 5 rows');
    // Every row is theirs, so the rows are told apart by account, not by customer.
    expect(Array.from(orders.querySelectorAll('app-filter-select .dash-label')).map(text)).toEqual([
      'Status',
      'Side',
      'Asset',
      'Account',
      'Fill',
    ]);

    choose('Status', 'REJECTED');
    expect(assets()).toEqual(['TSLA']);
    choose('Status', 'All statuses');
    choose('Side', 'Deposit');
    expect(assets()).toEqual(['Cash']);
    choose('Side', 'All sides');

    const input = orders.querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = 'nvda';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(assets()).toEqual(['NVDA']);
    expect(text(orders.querySelector('[data-count]')!)).toBe('1 of 5 rows');
  });

  it("lists the customer's orders by account and opens one", () => {
    render();
    const orders = card('Orders');

    expect(cells(orders.querySelector('.dash-table-head')!)[2]).toBe('Account');
    orders.querySelector<HTMLButtonElement>('[role="rowgroup"] > [role="row"] button')!.click();
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
    expect(loadOrder).toHaveBeenCalledWith(10482);
    expect(root().querySelector('app-order-detail')).not.toBeNull();

    root().querySelector<HTMLButtonElement>('button[aria-label="Close order detail"]')!.click();
    fixture.detectChanges();
    expect(root().querySelector('app-order-detail')).toBeNull();
  });

  it('copes with a trader who has no trading profile and no orders', () => {
    load.mockReturnValue(
      of(
        customerDetail({
          name: 'newcomer@example.com',
          traderLevel: null,
          sessionTimeoutMinutes: null,
          lastActiveAt: null,
          accountBalances: [],
          orders: [],
          transfers: [],
        }),
      ),
    );
    render();

    expect(facts('Profile')).toMatchObject({ 'Trader level': '—', 'Last active': '—' });
    expect(facts('Security')['Idle timeout']).toBe('—');
    expect(text(card('Orders'))).toContain("This customer hasn't placed any orders yet.");
    expect(card('Orders').querySelector('input')).toBeNull();
    expect(card('Total balance').querySelectorAll('li')).toHaveLength(1);
  });

  it('offers the page as a pdf only', () => {
    render();

    root().querySelector<HTMLButtonElement>('app-export-menu button')!.click();
    fixture.detectChanges();
    expect(Array.from(root().querySelectorAll('[role="menuitem"]')).map(text)).toEqual(['Export PDF']);
  });

  it('reads the customer again on its own', () => {
    render();
    vi.advanceTimersByTime(CUSTOMER_REFRESH_MS);
    TestBed.tick();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('shows loading, then a way back and a retry when the customer cannot be read', () => {
    load.mockReturnValue(throwError(() => new Error('down')));
    create();
    expect(text(root().querySelector('[role="status"]')!)).toBe('Loading the customer…');
    // The page's shape stands in for it: who it is, the three cards, then the orders table.
    expect(root().querySelector('[data-skeleton]')).not.toBeNull();
    expect(root().querySelectorAll('app-skeleton-facts')).toHaveLength(2);
    expect(root().querySelector('.net-worth-card .skeleton')).not.toBeNull();
    expect(root().querySelectorAll('app-skeleton-table [data-filter]')).toHaveLength(5);
    expect(root().querySelector('app-skeleton-table [data-row]')!.children).toHaveLength(9);

    settle();
    const alert = root().querySelector('[role="alert"]')!;
    expect(text(alert)).toContain("We couldn't load this customer.");
    expect(root().querySelector('.skeleton')).toBeNull();
    expect(alert.querySelector('a')!.getAttribute('href')).toBe('/customers');

    load.mockReturnValue(of(customerDetail()));
    alert.querySelector<HTMLButtonElement>('button')!.click();
    TestBed.tick();
    fixture.detectChanges();
    expect(text(root().querySelector('h1')!)).toBe('Sean Cheema');
  });
});
