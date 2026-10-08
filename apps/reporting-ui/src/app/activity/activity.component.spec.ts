import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { fakeReportStore, report, schedulerStatus } from '../../testing/fixtures';
import { ReportState, ReportStore } from '../reporting/report-store.service';
import { ActivityComponent } from './activity.component';

describe('ActivityComponent', () => {
  let fixture: ComponentFixture<ActivityComponent>;
  let store: ReturnType<typeof fakeReportStore>;

  const render = (state: ReportState = 'ready') => {
    store = fakeReportStore(state);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ReportStore, useValue: store }],
    });
    fixture = TestBed.createComponent(ActivityComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  const text = (element: Element) => element.textContent!.replace(/\s+/g, ' ').trim();
  const card = (root: HTMLElement, heading: string) =>
    Array.from(root.querySelectorAll('section')).find(
      (section) => section.querySelector('h2')?.textContent?.trim() === heading,
    )!;
  // Cells are read one by one: the compiled template drops the whitespace between them.
  const cells = (element: Element) => Array.from(element.children).map(text);
  const tableRows = (section: HTMLElement) => Array.from(section.querySelectorAll('li')).map(cells);
  const firstColumn = (section: HTMLElement) => tableRows(section).map((row) => row[0]);
  const figures = (section: HTMLElement) => Array.from(section.querySelectorAll('p')).map(text);
  const sortBy = (section: HTMLElement, label: string) => {
    section.querySelector<HTMLButtonElement>(`button[aria-label="Sort by ${label}"]`)!.click();
    fixture.detectChanges();
  };

  it('shows the headline figures of the latest run', () => {
    const root = render();

    expect(text(root)).toContain('From the trade-events topic · run generated');
    expect(text(root)).toContain('days in UTC');
    expect(figures(card(root, 'Orders resolved'))).toEqual(['8', '14 events ingested']);
    expect(figures(card(root, 'Fill rate'))).toEqual(['75.0%', '6 filled']);
    expect(figures(card(root, 'Rejected'))).toEqual(['2', '25.0% of resolved']);
    expect(figures(card(root, 'Notional traded'))).toEqual(['$6,044', '29.5 shares · 2 symbols']);
    expect(figures(card(root, 'Active accounts'))).toEqual(['2', 'at least one resolved order']);
  });

  it('splits resolved orders by status', () => {
    const section = card(render(), 'Orders by status');
    const pills = Array.from(section.querySelectorAll('.status-pill')).map(text);
    expect(pills).toEqual(['Filled', 'Rejected']);
    expect(text(section)).toContain('75.0%');
    expect(text(section)).toContain('25.0%');
    const meters = section.querySelectorAll<HTMLElement>('.h-full');
    expect(meters[0].style.width).toBe('75%');
    expect(meters[1].style.width).toBe('25%');
  });

  it('lists symbols by notional and re-sorts on a column heading', () => {
    const section = card(render(), 'Most traded');
    expect(tableRows(section)).toEqual([
      ['NVDA', '4', '25', '$4,619.25'],
      ['AAPL', '2', '4.5', '$1,424.66'],
    ]);

    sortBy(section, 'Asset');
    expect(firstColumn(section)).toEqual(['NVDA', 'AAPL']);
    sortBy(section, 'Asset');
    expect(firstColumn(section)).toEqual(['AAPL', 'NVDA']);

    sortBy(section, 'Fills');
    expect(firstColumn(section)).toEqual(['NVDA', 'AAPL']);
    sortBy(section, 'Shares');
    sortBy(section, 'Shares');
    expect(firstColumn(section)).toEqual(['AAPL', 'NVDA']);
    sortBy(section, 'Notional');
    expect(firstColumn(section)).toEqual(['NVDA', 'AAPL']);
  });

  it('lists accounts, naming unknown ones by id, and re-sorts them', () => {
    const section = card(render(), 'Accounts');
    expect(tableRows(section)).toEqual([
      ['Growth', 'Sean Cheema', '5', '4', '1'],
      ['Account 12', 'Unknown', '3', '2', '1'],
    ]);

    sortBy(section, 'Account');
    expect(firstColumn(section)).toEqual(['Growth', 'Account 12']);
    sortBy(section, 'Trader');
    sortBy(section, 'Trader');
    expect(firstColumn(section)).toEqual(['Account 12', 'Growth']);
    sortBy(section, 'Filled');
    expect(firstColumn(section)).toEqual(['Growth', 'Account 12']);
    sortBy(section, 'Orders');
    sortBy(section, 'Orders');
    expect(firstColumn(section)).toEqual(['Account 12', 'Growth']);
    sortBy(section, 'Rejected');
    expect(firstColumn(section)).toHaveLength(2);
  });

  it('describes the report pipeline and its schedule', () => {
    const root = render();
    const section = card(root, 'Report pipeline');
    const facts = () => cells(section.querySelector('dl')!);

    expect(text(section)).toContain('On schedule');
    expect(facts().slice(0, 7)).toEqual([
      'Events ingested',
      '14',
      'Latest run',
      '20261008T194500Z',
      'Runs every',
      '15 min',
      'Next run',
    ]);
    expect(facts()[7]).toMatch(/^\d{1,2}:00 [AP]M/);
    expect(section.querySelector('a')!.getAttribute('href')).toBe('/runs');

    store.overdue.set(true);
    fixture.detectChanges();
    expect(text(section)).toContain('Run overdue');

    store.overdue.set(false);
    store.scheduler.set(null);
    store.nextRunAt.set(null);
    fixture.detectChanges();
    expect(text(section)).toContain('Waiting');
    expect(facts().slice(4)).toEqual(['Runs every', '—', 'Next run', '—']);
  });

  it('refreshes on demand and shows when a refresh is running or failed', () => {
    const root = render();
    const button = root.querySelector<HTMLButtonElement>('app-page-header button')!;

    button.click();
    expect(store.refresh).toHaveBeenCalledTimes(1);

    store.refreshing.set(true);
    store.refreshFailed.set(true);
    fixture.detectChanges();
    expect(button.disabled).toBe(true);
    expect(text(button)).toBe('Refreshing…');
    expect(text(root.querySelector('[role="status"]')!)).toContain(
      "We couldn't refresh the report. Showing the run generated",
    );
  });

  it('says a single symbol in the singular and copes with nothing resolved', () => {
    const root = render();
    store.report.set(
      report({
        statusCounts: { FILLED: 0, REJECTED: 0 },
        volumeBySymbol: [{ symbol: 'SPY', fills: 0, shares: '0', notional: '0' }],
        tradesPerAccount: [],
        dailyCounts: [],
      }),
    );
    fixture.detectChanges();

    expect(figures(card(root, 'Notional traded'))).toEqual(['$0', '0 shares · 1 symbol']);
    expect(figures(card(root, 'Fill rate'))).toEqual(['—', '0 filled']);
    expect(figures(card(root, 'Rejected'))).toEqual(['0', 'none resolved yet']);
    expect(text(card(root, 'Accounts'))).toContain('No account has a resolved order yet.');
    expect(text(card(root, 'Trades per day'))).toContain('No orders have resolved yet.');

    store.report.set(report({ volumeBySymbol: [] }));
    fixture.detectChanges();
    expect(text(card(root, 'Most traded'))).toContain('No orders have filled yet.');
  });

  it('shows a loading state before the first report arrives', () => {
    const root = render('loading');
    expect(text(root)).toContain('Loading the latest report…');
    expect(text(root)).toContain('From the trade-events topic');
  });

  it('explains when the first run is due while there is no report', () => {
    const root = render('empty');
    expect(text(root)).toContain('No report yet');
    expect(text(root)).toContain('writes the first run 15 minutes after it starts');

    store.scheduler.set(null);
    fixture.detectChanges();
    expect(text(root)).toContain('on its next scheduled pass');

    store.scheduler.set(schedulerStatus({ interval_minutes: 5 }));
    fixture.detectChanges();
    expect(text(root)).toContain('first run 5 minutes');
  });

  it('offers a retry when the report cannot be loaded', () => {
    const root = render('error');
    expect(text(root.querySelector('[role="alert"]')!)).toContain("We couldn't load the report.");

    Array.from(root.querySelectorAll('button'))
      .find((button) => button.textContent!.includes('Try again'))!
      .click();
    expect(store.refresh).toHaveBeenCalledTimes(1);
  });
});
