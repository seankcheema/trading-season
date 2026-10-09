import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { activity } from '../../testing/console-fixtures';
import { text } from '../../testing/dom';
import { Activity, ActivityRange } from '../reporting/console.models';
import { ReportingApiService } from '../reporting/reporting-api.service';
import { ACTIVITY_REFRESH_MS, ActivityComponent } from './activity.component';

describe('ActivityComponent', () => {
  let fixture: ComponentFixture<ActivityComponent>;
  let load: ReturnType<typeof vi.fn<(range: ActivityRange) => Observable<Activity>>>;

  beforeEach(() => {
    vi.useFakeTimers();
    load = vi.fn((range: ActivityRange) => of(activity({ range })));
  });
  afterEach(() => vi.useRealTimers());

  const settle = (ms = 0) => {
    vi.advanceTimersByTime(ms);
    fixture.detectChanges();
  };

  const render = () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ReportingApiService, useValue: { activity: (range: ActivityRange) => load(range) } },
      ],
    });
    fixture = TestBed.createComponent(ActivityComponent);
    fixture.detectChanges();
    settle();
    return fixture.nativeElement as HTMLElement;
  };

  const card = (root: HTMLElement, heading: string) =>
    Array.from(root.querySelectorAll('section')).find(
      (section) => text(section.querySelector('h2')!) === heading,
    )!;
  const rows = (section: HTMLElement) =>
    Array.from(section.querySelectorAll('li')).map((row) => text(row));

  it('shows the headline figures against the prior period', () => {
    const root = render();

    expect(text(card(root, 'Orders'))).toBe('Orders 1,424 +8.40% vs prior period');
    expect(text(card(root, 'Fill rate'))).toBe('Fill rate 90.2% -1.10% 1,284 filled');
    expect(text(card(root, 'Rejected'))).toBe('Rejected 67 41 insufficient funds for this order');
    expect(text(card(root, 'Net cash flow'))).toBe(
      'Net cash flow +$84,210 +3.20% deposits – withdrawals',
    );
    // No pill when the prior period has nothing to compare with.
    expect(text(card(root, 'Active traders'))).toBe('Active traders 312 placed ≥ 1 order');
    expect(card(root, 'Fill rate').querySelector('app-change-pill')!.className).toContain('text-loss');
    expect(text(root.querySelector('app-page-header p')!)).toMatch(
      /^Derived from order and cash ledgers · updated \d{1,2}:\d{2} [AP]M · simulation session #12$/,
    );
  });

  it('charts notional traded by the hour, in the color of the change', () => {
    const root = render();
    const notional = card(root, 'Notional traded');

    expect(text(notional.querySelector('p')!)).toBe('$6,044 +8.40%');
    expect(notional.querySelector('[role="img"]')!.getAttribute('aria-label')).toBe(
      'Notional traded, Today: $6,044',
    );
    expect(notional.querySelector('[data-line]')!.getAttribute('class')).toContain('stroke-gain');
    const hours = Array.from(notional.querySelectorAll('[data-axis="x"] > span')).map(text);
    expect(hours).toHaveLength(3);
    expect(hours.every((label) => /^\d{1,2} [AP]M$/.test(label))).toBe(true);
  });

  it('turns the chart red for a period that fell and leaves out a change it cannot work out', () => {
    load.mockReturnValue(
      of(activity({ notional: { total: 10, change: -5, points: [{ at: '2026-10-08T13:00:00Z', value: 10 }] } })),
    );
    let notional = card(render(), 'Notional traded');
    expect(notional.querySelector('[data-line]')!.getAttribute('class')).toContain('stroke-loss');

    TestBed.resetTestingModule();
    load.mockReturnValue(of(activity({ notional: { total: 10, change: null, points: [] } })));
    notional = card(render(), 'Notional traded');
    expect(text(notional.querySelector('p')!)).toBe('$10');
    expect(notional.querySelector('[data-line]')!.getAttribute('class')).toContain('stroke-gain');
  });

  it('splits orders by status and links to the orders', () => {
    const root = render();
    const statuses = card(root, 'Orders by status');

    expect(Array.from(statuses.querySelectorAll('.mt-5 > div')).map(text)).toEqual([
      'filled 6 60.0%',
      'pending 1 10.0%',
      'accepted 1 10.0%',
      'rejected 2 20.0%',
    ]);
    const bars = Array.from(statuses.querySelectorAll<HTMLElement>('.h-full'));
    expect(bars.map((bar) => bar.style.width)).toEqual(['60%', '10%', '10%', '20%']);
    expect(bars.map((bar) => bar.className.match(/bg-\w+/)![0])).toEqual([
      'bg-gain',
      'bg-primary',
      'bg-primary',
      'bg-loss',
    ]);
    expect(statuses.querySelector('a')!.getAttribute('href')).toBe('/orders');
  });

  it('describes each kind of event in the live feed', () => {
    const feed = rows(card(render(), 'Live activity'));

    expect(feed).toHaveLength(7);
    expect(feed[0]).toMatch(/^Sean Cheema bought 4 AAPL .* \$1,266\.36$/);
    expect(feed[1]).toMatch(/^Priya Natarajan sold 25 NVDA .* \$4,619\.25$/);
    expect(feed[2]).toMatch(/^Order #10480 rejected — insufficient funds for this order .* TSLA$/);
    expect(feed[3]).toMatch(/^Order #10479 rejected (?!—).* SPY$/);
    expect(feed[4]).toMatch(/^Marcus Lee deposited cash .* \+\$2,500\.00$/);
    expect(feed[5]).toMatch(/^Priya Natarajan withdrew cash .* -\$800\.00$/);
    expect(feed[6]).toMatch(/^Jane Doe locked after 5 failed sign-ins .* Security$/);
  });

  it('lists the most traded symbols under the chosen range', () => {
    const traded = card(render(), 'Most traded');

    expect(text(traded.querySelector('.dash-table-head')!)).toBe('Asset Today Orders Notional');
    expect(rows(traded)).toEqual(['NVDA 312 $1,840,220', 'AAPL 268 $1,210,450']);
    expect(traded.querySelectorAll('app-sparkline path')).toHaveLength(2);
  });

  it('says so when nothing happened', () => {
    load.mockReturnValue(
      of(
        activity({
          sessionId: null,
          feed: [],
          mostTraded: [],
          statuses: [{ status: 'FILLED', count: 0 }],
          kpis: {
            ...activity().kpis,
            fillRate: { value: null, change: null, filled: 0 },
            rejected: { value: 0, topReason: null, topReasonCount: 0 },
          },
        }),
      ),
    );
    const root = render();

    expect(text(card(root, 'Live activity'))).toContain('Nothing has happened yet.');
    expect(text(card(root, 'Most traded'))).toContain('No orders were placed in this period.');
    expect(text(card(root, 'Fill rate'))).toBe('Fill rate — 0 filled');
    expect(text(card(root, 'Rejected'))).toBe('Rejected 0 none in this period');
    expect(text(card(root, 'Orders by status'))).toContain('filled 0 0.0%');
    expect(text(root.querySelector('app-page-header p')!)).not.toContain('session');
  });

  it('loads another range when one is chosen and plots it by the day', () => {
    const root = render();
    expect(load).toHaveBeenLastCalledWith('today');

    const week = Array.from(root.querySelectorAll('app-timeframe-toggle button')).find(
      (button) => text(button) === '7D',
    ) as HTMLButtonElement;
    week.click();
    settle();

    expect(load).toHaveBeenLastCalledWith('7d');
    expect(week.getAttribute('aria-pressed')).toBe('true');
    const traded = card(root, 'Most traded');
    expect(text(traded.querySelector('.dash-table-head')!)).toBe('Asset 7D Orders Notional');
    const days = Array.from(root.querySelectorAll('[data-axis="x"] > span')).map(text);
    expect(days.every((label) => /^[A-Z][a-z]{2} \d{1,2}$/.test(label))).toBe(true);
  });

  it('reads the ledgers again on its own', () => {
    render();
    expect(load).toHaveBeenCalledTimes(1);

    settle(ACTIVITY_REFRESH_MS);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('shows a loading state, and offers a retry when the load fails', () => {
    load.mockReturnValue(throwError(() => new Error('down')));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ReportingApiService, useValue: { activity: (range: ActivityRange) => load(range) } },
      ],
    });
    fixture = TestBed.createComponent(ActivityComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(text(root)).toContain('Loading activity…');
    expect(text(root.querySelector('app-page-header p')!)).toBe('Derived from order and cash ledgers');

    settle();
    expect(text(root.querySelector('[role="alert"]')!)).toContain("We couldn't load the activity.");

    load.mockReturnValue(of(activity()));
    root.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    fixture.detectChanges();
    expect(text(card(root, 'Orders'))).toContain('1,424');
  });

  it('exports the status split of the chosen range as csv', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const blobs: Blob[] = [];
    URL.createObjectURL = ((blob: Blob) => (blobs.push(blob), 'blob:csv')) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const root = render();

    root.querySelector<HTMLButtonElement>('app-export-menu button')!.click();
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('[role="menuitem"]')!.click();

    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('activity-today.csv');
    expect(blobs[0].size).toBeGreaterThan(0);
    click.mockRestore();
  });
});
