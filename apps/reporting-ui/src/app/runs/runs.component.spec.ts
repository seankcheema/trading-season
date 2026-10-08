import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { fakeReportStore, run } from '../../testing/fixtures';
import { ReportState, ReportStore } from '../reporting/report-store.service';
import { ReportingApiService } from '../reporting/reporting-api.service';
import { RunsComponent } from './runs.component';

describe('RunsComponent', () => {
  let fixture: ComponentFixture<RunsComponent>;
  let store: ReturnType<typeof fakeReportStore>;
  let runFile: ReturnType<typeof vi.fn>;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    let next = 0;
    createObjectURL = vi.fn(() => `blob:chart-${++next}`);
    revokeObjectURL = vi.fn();
    // jsdom has no object URLs.
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
    runFile = vi.fn(() => of(new Blob(['png'], { type: 'image/png' })));
  });

  const render = (state: ReportState = 'ready', prepare?: () => void) => {
    store = fakeReportStore(state);
    prepare?.();
    TestBed.configureTestingModule({
      providers: [
        { provide: ReportStore, useValue: store },
        { provide: ReportingApiService, useValue: { runFile } },
      ],
    });
    fixture = TestBed.createComponent(RunsComponent);
    settle();
    return fixture.nativeElement as HTMLElement;
  };

  // The chart request starts from an effect, so render twice: once to run it, once to show it.
  const settle = () => {
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
  };

  const text = (root: HTMLElement) => root.textContent!.replace(/\s+/g, ' ');
  const rows = (root: HTMLElement) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('li > button'));

  it('lists the runs and shows the charts of the latest one', () => {
    const root = render();

    expect(text(root)).toContain('Written by the reporting consumer every 15 minutes');
    expect(rows(root)).toHaveLength(1);
    expect(text(rows(root)[0])).toContain('20261008T194500Z');
    expect(rows(root)[0].querySelector('.status-pill')!.textContent!.trim()).toBe('Latest');
    expect(rows(root)[0].getAttribute('aria-pressed')).toBe('true');

    expect(runFile).toHaveBeenCalledWith('20261008T194500Z', 'volume_by_symbol.png');
    expect(runFile).toHaveBeenCalledTimes(3);
    const images = Array.from(root.querySelectorAll('img'));
    expect(images.map((image) => image.getAttribute('src'))).toEqual([
      'blob:chart-1',
      'blob:chart-2',
      'blob:chart-3',
    ]);
    expect(images[0].alt).toBe('Traded value by symbol, chart from run 20261008T194500Z');
    const download = root.querySelector<HTMLAnchorElement>('a[download]')!;
    expect(download.download).toBe('20261008T194500Z-volume_by_symbol.png');
    expect(text(root)).toContain('Trades per day');
    expect(text(root)).toContain('Orders per account');
  });

  it('shows each chart as loading until its image arrives', () => {
    const pending = new Subject<Blob>();
    runFile.mockReturnValue(pending);
    const root = render();
    expect(text(root)).toContain('Loading chart…');
    expect(root.querySelector('img')).toBeNull();

    pending.next(new Blob(['png']));
    pending.complete();
    settle();
    expect(root.querySelectorAll('img')).toHaveLength(3);
  });

  it('says which chart failed and names an unknown file by its file name', () => {
    runFile.mockImplementation((_runId: string, name: string) =>
      name === 'extra.png' ? of(new Blob(['png'])) : throwError(() => new Error('gone')),
    );
    const root = render('ready', () =>
      store.runs.set([run({ files: ['daily_trades.png', 'extra.png'] })]),
    );

    expect(text(root)).toContain("We couldn't load this chart.");
    expect(text(root)).toContain('extra.png');
    expect(root.querySelectorAll('img')).toHaveLength(1);
  });

  it('switches to another run and releases the previous charts', () => {
    const older = run({ runId: '20261008T193000Z', files: ['daily_trades.png'] });
    const root = render('ready', () => store.runs.set([run(), older]));
    expect(rows(root)).toHaveLength(2);

    rows(root)[1].click();
    settle();

    expect(revokeObjectURL).toHaveBeenCalledTimes(3);
    expect(runFile).toHaveBeenLastCalledWith('20261008T193000Z', 'daily_trades.png');
    expect(rows(root)[1].getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelectorAll('img')).toHaveLength(1);

    fixture.destroy();
    expect(revokeObjectURL).toHaveBeenCalledTimes(4);
  });

  it('shows no charts for a run without files', () => {
    const root = render('ready', () => store.runs.set([run({ files: [] })]));
    expect(runFile).not.toHaveBeenCalled();
    expect(root.querySelector('img')).toBeNull();
  });

  it('refreshes on demand', () => {
    const root = render();
    const button = root.querySelector<HTMLButtonElement>('app-page-header button')!;
    button.click();
    expect(store.refresh).toHaveBeenCalledTimes(1);

    store.refreshing.set(true);
    fixture.detectChanges();
    expect(button.textContent).toContain('Refreshing…');
  });

  it('shows loading and empty states', () => {
    const root = render('loading');
    expect(text(root)).toContain('Loading report runs…');

    store.state.set('empty');
    store.scheduler.set(null);
    fixture.detectChanges();
    expect(text(root)).toContain('No report runs yet');
    expect(text(root)).toContain('Written by the reporting consumer · each run replaces');
  });
});
