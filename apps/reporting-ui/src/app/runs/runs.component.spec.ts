import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { text } from '../../testing/dom';
import { fakeReportStore, report, run, schedulerStatus } from '../../testing/fixtures';
import { ReportState, ReportStore } from '../reporting/report-store.service';
import { ReportingApiService } from '../reporting/reporting-api.service';
import { RunsComponent } from './runs.component';

describe('RunsComponent', () => {
  let fixture: ComponentFixture<RunsComponent>;
  let store: ReturnType<typeof fakeReportStore>;
  let runFile: ReturnType<typeof vi.fn>;
  let runs: ReturnType<typeof vi.fn>;
  let saved: { name: string; file: Blob }[];
  let click: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    saved = [];
    // jsdom has no object URLs; the saved file is read back from what the link was given.
    const files: Blob[] = [];
    URL.createObjectURL = ((file: Blob) => (files.push(file), 'blob:chart')) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      saved.push({ name: this.download, file: files[files.length - 1] });
    });
    runFile = vi.fn(() => of(new Blob(['png'], { type: 'image/png' })));
    runs = vi.fn(() => of({ latest: '20261008T194500Z', runs: [], timestamp: '' }));
  });
  afterEach(() => click.mockRestore());

  const render = (state: ReportState = 'ready', prepare?: () => void) => {
    store = fakeReportStore(state);
    prepare?.();
    TestBed.configureTestingModule({
      providers: [
        { provide: ReportStore, useValue: store },
        { provide: ReportingApiService, useValue: { runFile, runs } },
      ],
    });
    fixture = TestBed.createComponent(RunsComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  const card = (root: HTMLElement, heading: string) =>
    Array.from(root.querySelectorAll('section')).find(
      (section) => text(section.querySelector('h2')!) === heading,
    )!;
  const meters = (section: HTMLElement) =>
    Array.from(section.querySelectorAll('[data-meters] > li')).map(text);
  const widths = (section: HTMLElement) =>
    Array.from(section.querySelectorAll<HTMLElement>('[data-meters] .h-full')).map(
      (bar) => `${bar.className.match(/bg-\w+/)![0]} ${Math.round(parseFloat(bar.style.width))}%`,
    );

  it('offers the screen as a PDF, and no CSV', () => {
    const root = render();
    const menu = root.querySelector('app-export-menu')!;

    menu.querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();

    expect(Array.from(menu.querySelectorAll('[role="menuitem"]')).map(text)).toEqual(['Export PDF']);
  });

  it('fills the window from 1280px wide, with its lists scrolling inside their cards', () => {
    const root = render();

    expect(root.className).toContain('xl:flex-1');
    expect(root.className).toContain('xl:min-h-[37.5rem]');
    const list = card(root, 'Traded value by symbol').querySelector('[data-meters]')!;
    expect(list.className).toContain('dash-scroll');
    expect(list.className).toContain('xl:flex-1');
    // The chart takes the room its card has left, and keeps a fixed height on paper.
    const plot = card(root, 'Trades per day').querySelector('[data-plot]')!;
    expect(plot.className).toContain('xl:h-auto');
    expect(plot.className).toContain('print:h-52');
  });

  it('names the run on screen and says when the next one is due', () => {
    const root = render();
    const header = root.querySelector('app-page-header')!;

    expect(text(header.querySelector('p')!)).toMatch(
      /^Run 20261008T194500Z · generated Oct 8, \d{1,2}:45 [AP]M \S+ · replaced every 15 minutes$/,
    );
    expect(text(header.querySelector('[data-schedule]')!)).toMatch(/^Next run \d{1,2}:00 [AP]M \S+$/);
    expect(header.querySelector('app-change-pill')).toBeNull();
  });

  it('flags a run that is late, which is how a stopped consumer shows', () => {
    const root = render('ready', () => store.overdue.set(true));
    const schedule = root.querySelector('[data-schedule]')!;

    expect(text(schedule)).toMatch(/^Overdue expected \d{1,2}:00 [AP]M \S+$/);
    expect(schedule.querySelector('app-change-pill')!.className).toContain('text-loss');

    // Without a run to count from there is no schedule to show.
    store.nextRunAt.set(null);
    fixture.detectChanges();
    expect(root.querySelector('[data-schedule]')).toBeNull();
  });

  it('leads with the headline figures of the run', () => {
    const root = render();

    expect(text(card(root, 'Orders resolved'))).toBe('Orders resolved 8 14 events read');
    expect(text(card(root, 'Fill rate'))).toBe('Fill rate 75.0% 6 filled');
    expect(text(card(root, 'Rejected'))).toBe('Rejected 2 25.0% of resolved');
    expect(text(card(root, 'Traded value'))).toBe('Traded value $6,044 29.5 shares filled');
    expect(text(card(root, 'Active accounts'))).toBe('Active accounts 2 2 symbols traded');
  });

  it('draws filled and rejected orders per day as stacked columns on a whole-number axis', () => {
    const daily = card(render(), 'Trades per day');

    // The busiest day resolved five orders, so the axis climbs in twos to six.
    expect(Array.from(daily.querySelectorAll('[data-axis="y"] span')).map(text)).toEqual([
      '0',
      '2',
      '4',
      '6',
    ]);
    const days = Array.from(daily.querySelectorAll<HTMLElement>('[data-day]'));
    expect(days).toHaveLength(2);
    // Two days stand in two of eight slots instead of filling the plot.
    expect(days.map((day) => day.style.width)).toEqual(['12.5%', '12.5%']);
    const heights = (day: HTMLElement) =>
      Array.from(day.querySelectorAll<HTMLElement>('span')).map(
        (part) => `${part.className.match(/bg-\w+/)![0]} ${Math.round(parseFloat(part.style.height))}%`,
      );
    expect(heights(days[0])).toEqual(['bg-loss 17%', 'bg-gain 33%']);
    expect(heights(days[1])).toEqual(['bg-loss 17%', 'bg-gain 67%']);
    expect(Array.from(daily.querySelectorAll('[data-axis="x"] span')).map(text)).toEqual(['Oct 7', 'Oct 8']);
    expect(text(daily.querySelector('[data-legend]')!)).toBe('Filled Rejected');
    // The drawn chart is hidden from a screen reader, which gets the same figures as a table.
    expect(Array.from(daily.querySelectorAll('table tbody tr')).map(text)).toEqual(['Oct 7 2 1', 'Oct 8 4 1']);
    // Hidden by a wrapper: a table of its own keeps its height, and a long one scrolled the window.
    const figures = daily.querySelector('table')!;
    expect(figures.classList.contains('sr-only')).toBe(false);
    expect(figures.parentElement!.matches('div.sr-only')).toBe(true);
  });

  it('reads out the newest day, or the day under the pointer', () => {
    const daily = card(render(), 'Trades per day');
    const readout = () => text(daily.querySelector('[data-readout]')!);
    const days = Array.from(daily.querySelectorAll<HTMLElement>('[data-day]'));
    expect(readout()).toBe('Oct 8 · 4 filled · 1 rejected');

    days[0].dispatchEvent(new Event('pointerenter'));
    fixture.detectChanges();
    expect(readout()).toBe('Oct 7 · 2 filled · 1 rejected');
    expect(days[1].className).toContain('opacity-40');
    expect(days[0].className).not.toContain('opacity-40');

    daily.querySelector('[data-plot]')!.dispatchEvent(new Event('pointerleave'));
    fixture.detectChanges();
    expect(readout()).toBe('Oct 8 · 4 filled · 1 rejected');
    expect(days[1].className).not.toContain('opacity-40');
  });

  it('rounds the top of a day that only filled, and spreads a few labels over many days', () => {
    const dailyCounts = Array.from({ length: 12 }, (_, index) => ({
      date: `2026-10-${String(index + 1).padStart(2, '0')}`,
      filled: index + 1,
      rejected: 0,
    }));
    const daily = card(
      render('ready', () => store.report.set(report({ dailyCounts }))),
      'Trades per day',
    );

    const first = daily.querySelector<HTMLElement>('[data-day] span')!;
    expect(first.className).toContain('bg-gain');
    expect(first.className).toContain('rounded-t');
    const labels = Array.from(daily.querySelectorAll<HTMLElement>('[data-axis="x"] span'));
    expect(labels.map(text)).toEqual(['Oct 1', 'Oct 4', 'Oct 7', 'Oct 9', 'Oct 12']);
    // The first label starts at its column and the last one ends at its own.
    expect(labels[0].style.transform).toBe('translateX(0)');
    expect(labels[2].style.transform).toBe('translateX(-50%)');
    expect(labels[4].style.transform).toBe('translateX(-100%)');
  });

  it('splits traded value by client segment, each with its share', () => {
    const segments = card(render(), 'Traded value by client segment');

    expect(meters(segments)).toEqual([
      'Beginner $0.00 0.0% 0 accounts · 0 filled · 0 rejected',
      'Intermediate $0.00 0.0% 0 accounts · 0 filled · 0 rejected',
      'Advanced $4,619.25 76.4% 1 account · 4 filled · 1 rejected',
      'Unknown $1,424.66 23.6% 1 account · 2 filled · 1 rejected',
    ]);
    expect(widths(segments)).toEqual(['bg-primary 76%', 'bg-primary 24%']);
  });

  it('ranks symbols by traded value against the most traded one', () => {
    const symbols = card(render(), 'Traded value by symbol');

    expect(meters(symbols)).toEqual([
      'NVDA $4,619.25 4 fills · 25 shares',
      'AAPL $1,424.66 2 fills · 4.5 shares',
    ]);
    expect(widths(symbols)).toEqual(['bg-primary 100%', 'bg-primary 31%']);
  });

  it('shows each account with its filled and rejected orders in one bar', () => {
    const accounts = card(render(), 'Orders per account');

    expect(meters(accounts)).toEqual([
      'Growth (Sean Cheema) 5 orders 4 filled · 1 rejected',
      '12 3 orders 2 filled · 1 rejected',
    ]);
    expect(widths(accounts)).toEqual(['bg-gain 80%', 'bg-loss 20%', 'bg-gain 40%', 'bg-loss 20%']);
    expect(text(accounts.querySelector('[data-legend]')!)).toBe('Filled Rejected');
  });

  it('says so in each card when the run has nothing to show', () => {
    const root = render('ready', () =>
      store.report.set(
        report({
          statusCounts: { FILLED: 0, REJECTED: 0 },
          volumeBySymbol: [],
          tradesPerAccount: [],
          dailyCounts: [],
          activityBySegment: [],
        }),
      ),
    );

    expect(text(card(root, 'Rejected'))).toBe('Rejected 0 nothing resolved yet');
    expect(text(card(root, 'Fill rate'))).toBe('Fill rate — 0 filled');
    expect(text(card(root, 'Trades per day'))).toContain('No order has resolved yet.');
    expect(text(card(root, 'Traded value by client segment'))).toContain('This run has no split by segment.');
    expect(text(card(root, 'Traded value by symbol'))).toContain('No order has filled yet.');
    expect(text(card(root, 'Orders per account'))).toContain('No order has resolved yet.');
    expect(root.querySelector('[data-day]')).toBeNull();
  });

  it("downloads the report job's own chart for a card", () => {
    const root = render();
    const button = card(root, 'Trades per day').querySelector<HTMLButtonElement>('button')!;
    expect(button.getAttribute('aria-label')).toBe('Download Trades per day as PNG');
    expect(runFile).not.toHaveBeenCalled();

    button.click();

    expect(runFile).toHaveBeenCalledWith('20261008T194500Z', 'daily_trades.png');
    expect(saved.map((file) => file.name)).toEqual(['20261008T194500Z-daily_trades.png']);
    expect(saved[0].file.type).toBe('image/png');
  });

  it('offers no download for a chart the run does not have', () => {
    const root = render('ready', () => store.report.set(report({ files: ['daily_trades.png'] })));

    expect(card(root, 'Trades per day').querySelector('button')).not.toBeNull();
    expect(card(root, 'Traded value by symbol').querySelector('button')).toBeNull();
    expect(card(root, 'Orders per account').querySelector('button')).toBeNull();
  });

  it('says when a download failed and clears it on the next try', () => {
    runFile.mockReturnValueOnce(throwError(() => new Error('gone')));
    const root = render();
    const button = card(root, 'Traded value by symbol').querySelector<HTMLButtonElement>('button')!;

    button.click();
    fixture.detectChanges();
    expect(text(root.querySelector('[role="alert"]')!)).toBe("We couldn't download that chart. Try again.");
    expect(saved).toHaveLength(0);

    button.click();
    fixture.detectChanges();
    expect(root.querySelector('[role="alert"]')).toBeNull();
    expect(saved.map((file) => file.name)).toEqual(['20261008T194500Z-volume_by_symbol.png']);
  });

  it('takes a chart from the newest run when the one on screen has been replaced', () => {
    runFile.mockImplementationOnce(() => throwError(() => new HttpErrorResponse({ status: 404 })));
    runs.mockReturnValue(of({ latest: '20261008T200000Z', runs: [], timestamp: '' }));
    const root = render();

    card(root, 'Trades per day').querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();

    expect(runFile.mock.calls).toEqual([
      ['20261008T194500Z', 'daily_trades.png'],
      ['20261008T200000Z', 'daily_trades.png'],
    ]);
    expect(saved.map((file) => file.name)).toEqual(['20261008T200000Z-daily_trades.png']);
    // The screen moves to the run the file came from.
    expect(store.refresh).toHaveBeenCalledTimes(1);
    expect(root.querySelector('[role="alert"]')).toBeNull();
  });

  it('says a download failed when no newer run has the chart either', () => {
    runFile.mockImplementation(() => throwError(() => new HttpErrorResponse({ status: 404 })));
    const root = render();

    card(root, 'Trades per day').querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();

    // The newest run is the one already asked, so it is not asked again.
    expect(runFile).toHaveBeenCalledTimes(1);
    expect(text(root.querySelector('[role="alert"]')!)).toBe("We couldn't download that chart. Try again.");
    expect(saved).toHaveLength(0);
  });

  it("does not answer a request for an earlier run with another run's chart", () => {
    runFile.mockImplementation(() => throwError(() => new HttpErrorResponse({ status: 404 })));
    runs.mockReturnValue(of({ latest: '20261008T200000Z', runs: [], timestamp: '' }));
    const root = render('ready', () =>
      store.runs.set([run(), run({ runId: '20261008T193000Z', files: ['daily_trades.png'] })]),
    );

    root.querySelector<HTMLButtonElement>('[data-earlier] button')!.click();
    fixture.detectChanges();

    expect(runFile.mock.calls).toEqual([['20261008T193000Z', 'daily_trades.png']]);
    expect(runs).not.toHaveBeenCalled();
    expect(text(root.querySelector('[role="alert"]')!)).toBe("We couldn't download that chart. Try again.");
  });

  it('lists a run still on disk beside the one shown, with its charts to download', () => {
    const older = run({
      runId: '20261008T193000Z',
      generatedAt: '2026-10-08T19:30:00+00:00',
      eventCount: 1,
      files: ['daily_trades.png', 'extra.png'],
    });
    const root = render('ready', () => store.runs.set([run(), older]));
    const earlier = card(root, 'Earlier runs');
    const rows = Array.from(earlier.querySelectorAll('[data-earlier] > li'));

    expect(rows).toHaveLength(1);
    // A file the screen does not know is offered under its own name.
    expect(text(rows[0])).toMatch(/^20261008T193000Z Oct 8, \d{1,2}:30 [AP]M \S+ · 1 event Trades per day extra\.png$/);

    rows[0].querySelectorAll<HTMLButtonElement>('button')[1].click();
    expect(runFile).toHaveBeenCalledWith('20261008T193000Z', 'extra.png');
    expect(saved.map((file) => file.name)).toEqual(['20261008T193000Z-extra.png']);
  });

  it('shows no earlier runs when the one on screen is the only one', () => {
    const root = render();

    expect(card(root, 'Earlier runs')).toBeUndefined();
  });

  it('keeps the last report on screen when a refresh fails, and says so', () => {
    const root = render('ready', () => store.refreshFailed.set(true));

    expect(text(root.querySelector('[role="status"]')!)).toMatch(
      /^We couldn't refresh the report\. This is still the run generated Oct 8, \d{1,2}:45 [AP]M \S+\.$/,
    );
    expect(text(card(root, 'Orders resolved'))).toContain('8');
  });

  it('refreshes on demand', () => {
    const root = render();
    const button = root.querySelector<HTMLButtonElement>('app-page-header button')!;
    button.click();
    expect(store.refresh).toHaveBeenCalledTimes(1);

    store.refreshing.set(true);
    fixture.detectChanges();
    expect(button.textContent).toContain('Refreshing…');
    expect(button.disabled).toBe(true);
  });

  it('shows loading and empty states', () => {
    const root = render('loading');
    expect(text(root)).toContain('Loading report runs…');
    expect(root.querySelector('[data-meters]')).toBeNull();

    store.state.set('empty');
    store.scheduler.set(null);
    fixture.detectChanges();
    expect(text(root)).toContain('No report runs yet');
    expect(text(root)).toContain('Written by the reporting consumer · each run replaces');

    store.scheduler.set(schedulerStatus({ interval_minutes: 1 }));
    fixture.detectChanges();
    expect(text(root)).toContain('Written by the reporting consumer every minute · each run');
  });

  it('names the run without an interval until the scheduler has answered', () => {
    const root = render('ready', () => store.scheduler.set(null));

    expect(text(root.querySelector('app-page-header p')!)).toMatch(
      /^Run 20261008T194500Z · generated Oct 8, \d{1,2}:45 [AP]M \S+$/,
    );
  });

  it('offers a retry instead of an empty page when the service cannot be reached', () => {
    const root = render('error');
    expect(text(root.querySelector('[role="alert"]')!)).toContain("We couldn't load the report runs.");
    expect(text(root)).not.toContain('No report runs yet');

    Array.from(root.querySelectorAll('button'))
      .find((button) => button.textContent!.includes('Try again'))!
      .click();
    expect(store.refresh).toHaveBeenCalledTimes(1);
  });
});
