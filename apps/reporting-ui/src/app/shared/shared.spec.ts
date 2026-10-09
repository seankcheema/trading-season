import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { text } from '../../testing/dom';
import { ChangePillComponent, statusTone } from './change-pill.component';
import { DialogComponent } from './dialog.component';
import { ExportMenuComponent, downloadCsv, toCsv } from './export-menu.component';
import { FilterSelectComponent } from './filter-select.component';
import { LineChartComponent, smoothPath } from './line-chart.component';
import { Live, live } from './live';
import { SparklineComponent } from './sparkline.component';
import { TimeframeToggleComponent } from './timeframe-toggle.component';

// The small pieces the reporting screens are assembled from.

function render<T>(component: new (...args: never[]) => T, inputs: Record<string, unknown> = {}) {
  const fixture = TestBed.createComponent(component as never) as ComponentFixture<T>;
  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }
  fixture.detectChanges();
  return fixture;
}

describe('ChangePillComponent', () => {
  const classes = (element: HTMLElement) => Array.from(element.classList);

  it('shows a signed percentage in the gain or loss color', () => {
    const up = render(ChangePillComponent, { value: 8.4 }).nativeElement as HTMLElement;
    expect(up.textContent!.trim()).toBe('+8.40%');
    expect(classes(up)).toEqual(expect.arrayContaining(['text-gain', 'bg-gain/10', 'text-xs']));

    const down = render(ChangePillComponent, { value: -1.1 }).nativeElement as HTMLElement;
    expect(down.textContent!.trim()).toBe('-1.10%');
    expect(classes(down)).toEqual(expect.arrayContaining(['text-loss', 'bg-loss/10']));
  });

  it('is a small uppercase tag on a stronger tint when asked', () => {
    const tag = render(ChangePillComponent, { tag: true, tone: 'loss' }).nativeElement as HTMLElement;
    expect(classes(tag)).toEqual(
      expect.arrayContaining(['text-[10px]', 'uppercase', 'text-loss', 'bg-loss/15']),
    );

    const plain = render(ChangePillComponent, { tag: true }).nativeElement as HTMLElement;
    expect(classes(plain)).toEqual(expect.arrayContaining(['text-primary', 'bg-primary/15']));
    expect(plain.textContent!.trim()).toBe('');
  });

  it('knows the tone of each status and is quiet about one it does not know', () => {
    expect(['ACTIVE', 'FILLED'].map(statusTone)).toEqual(['gain', 'gain']);
    expect(['LOCKED', 'REJECTED'].map(statusTone)).toEqual(['loss', 'loss']);
    expect(['PENDING', 'ACCEPTED'].map(statusTone)).toEqual(['primary', 'primary']);
    expect(statusTone('CANCELLED')).toBe('muted');
  });
});

describe('TimeframeToggleComponent', () => {
  it('marks the chosen range and switches on a click', () => {
    const options = [
      { value: 'today', label: 'Today' },
      { value: '7d', label: '7D' },
    ];
    const fixture = render(TimeframeToggleComponent, { options, value: 'today' });
    const root = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(root.querySelectorAll('button'));

    expect(root.getAttribute('role')).toBe('group');
    expect(root.getAttribute('aria-label')).toBe('Range');
    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    expect(buttons[0].className).toContain('bg-primary');

    buttons[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('7d');
    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
  });
});

describe('export', () => {
  it('quotes every cell so commas, quotes and blanks survive', () => {
    expect(
      toCsv(
        ['Name', 'Note'],
        [
          ['Doe, Jane', 'said "hi"'],
          [7, null],
        ],
      ),
    ).toBe('"Name","Note"\n"Doe, Jane","said ""hi"""\n"7",""');
  });

  it('hands the browser a csv file to save', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const createObjectURL = vi.fn((blob: Blob) => `blob:${blob.type}`);
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;

    downloadCsv('orders', ['Order'], [[1]]);

    expect(createObjectURL.mock.calls[0][0].type).toBe('text/csv');
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe('orders.csv');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:text/csv');
    click.mockRestore();
  });
});

describe('ExportMenuComponent', () => {
  let fixture: ComponentFixture<ExportMenuComponent>;
  const root = () => fixture.nativeElement as HTMLElement;
  const trigger = () => root().querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!;
  const items = () =>
    Array.from(root().querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
  const open = () => {
    trigger().click();
    fixture.detectChanges();
  };

  beforeEach(() => {
    vi.useFakeTimers();
    fixture = render(ExportMenuComponent);
  });
  afterEach(() => vi.useRealTimers());

  it('opens a menu offering the rows as csv and the screen as pdf', () => {
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(items()).toHaveLength(0);

    open();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(items().map((item) => item.textContent!.trim())).toEqual(['Export CSV', 'Export PDF']);
  });

  it('asks the screen for its csv and closes', () => {
    const asked = vi.fn();
    fixture.componentInstance.exportCsv.subscribe(asked);
    open();
    items()[0].click();
    fixture.detectChanges();

    expect(asked).toHaveBeenCalledTimes(1);
    expect(items()).toHaveLength(0);
  });

  it('prints the screen for a pdf once the menu has closed', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    open();
    items()[1].click();
    fixture.detectChanges();
    expect(print).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });

  it('offers only the pdf on a screen without rows', () => {
    fixture.componentRef.setInput('csv', false);
    open();
    expect(items().map((item) => item.textContent!.trim())).toEqual(['Export PDF']);
  });

  it('closes on escape and on a press outside, but not on one inside', () => {
    open();
    trigger().dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();
    expect(items()).toHaveLength(2);

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();
    expect(items()).toHaveLength(0);

    open();
    root().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(items()).toHaveLength(0);
  });
});

describe('FilterSelectComponent', () => {
  let fixture: ComponentFixture<FilterSelectComponent>;
  const root = () => fixture.nativeElement as HTMLElement;
  const trigger = () => root().querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!;
  const options = () => Array.from(root().querySelectorAll<HTMLButtonElement>('[role="option"]'));

  beforeEach(() => {
    fixture = render(FilterSelectComponent, {
      label: 'Status',
      options: [{ value: 'ALL', label: 'All statuses' }, 'FILLED', 'REJECTED'],
      value: 'ALL',
    });
  });

  it('shows its caption and the label of the chosen option', () => {
    expect(root().querySelector('.dash-label')!.textContent).toBe('Status');
    expect(trigger().textContent!.trim()).toBe('All statuses');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(options()).toHaveLength(0);
  });

  it('opens a list with a check on the chosen option, and chooses another', () => {
    trigger().click();
    fixture.detectChanges();
    expect(options().map((option) => option.textContent!.trim())).toEqual([
      'All statuses',
      'FILLED',
      'REJECTED',
    ]);
    expect(options().map((option) => option.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    expect(options()[0].querySelector('ng-icon')).not.toBeNull();

    options()[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('FILLED');
    expect(trigger().textContent!.trim()).toBe('FILLED');
    expect(options()).toHaveLength(0);
  });

  it('closes on escape and on a press outside, but not on one inside', () => {
    trigger().click();
    fixture.detectChanges();
    trigger().dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();
    expect(options()).toHaveLength(3);

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();
    expect(options()).toHaveLength(0);

    trigger().click();
    fixture.detectChanges();
    root().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(options()).toHaveLength(0);
  });

  it('shows a value that is not among the options as it is', () => {
    fixture.componentRef.setInput('value', 'ACCEPTED');
    fixture.detectChanges();
    expect(trigger().textContent!.trim()).toBe('ACCEPTED');
  });
});

describe('smoothPath', () => {
  it('is empty without points and a single move for one', () => {
    expect(smoothPath([])).toBe('');
    expect(smoothPath([{ x: 50, y: 20 }])).toBe('M 50.00,20.00');
  });

  it('curves through every point without leaving the plot', () => {
    const path = smoothPath([
      { x: 0, y: 0 },
      { x: 50, y: 40 },
      { x: 100, y: 40 },
    ]);
    expect(path.startsWith('M 0.00,0.00 C ')).toBe(true);
    expect(path.endsWith(' 100.00,40.00')).toBe(true);
    const heights = Array.from(path.matchAll(/,(-?[\d.]+)/g)).map((match) => Number(match[1]));
    expect(Math.max(...heights)).toBe(40);
    expect(Math.min(...heights)).toBe(0);
  });
});

describe('LineChartComponent', () => {
  const points = [
    { value: 100, label: '1 PM' },
    { value: 300, label: '2 PM' },
    { value: 200, label: '3 PM' },
  ];
  let fixture: ComponentFixture<LineChartComponent>;
  const root = () => fixture.nativeElement as HTMLElement;
  const plot = () => root().querySelector<HTMLElement>('[role="img"]')!;
  const texts = (selector: string) =>
    Array.from(root().querySelectorAll(selector)).map((node) => node.textContent!.trim());

  const hoverAt = (clientX: number) => {
    plot().getBoundingClientRect = () => ({ left: 100, width: 200 }) as DOMRect;
    plot().dispatchEvent(new MouseEvent('pointermove', { clientX }));
    fixture.detectChanges();
  };

  it('draws the line between the lowest and highest value with a dollar axis', () => {
    fixture = render(LineChartComponent, { points, description: 'Notional traded' });

    // 100 sits 2 units above the bottom of the 40-unit plot and 300 2 below its top.
    expect(root().querySelector('[data-line]')!.getAttribute('d')).toMatch(
      /^M 0\.00,38\.00 C .* 50\.00,2\.00 C .* 100\.00,20\.00$/,
    );
    expect(root().querySelector('[data-line]')!.getAttribute('class')).toContain('stroke-gain');
    expect(texts('[aria-hidden="true"] > span.right-0')).toEqual([
      '$300',
      '$250',
      '$200',
      '$150',
      '$100',
    ]);
    expect(texts('[data-axis="x"] > span')).toEqual(['1 PM', '2 PM', '3 PM']);
    expect(plot().getAttribute('aria-label')).toBe('Notional traded');
    expect(root().querySelector('path[fill^="url("]')).toBeNull();
  });

  it('fills the area and takes the loss color for a period that fell', () => {
    fixture = render(LineChartComponent, { points, tone: 'loss', area: true });

    expect(root().querySelector('[data-line]')!.getAttribute('class')).toContain('stroke-loss');
    expect(root().querySelector('path[fill^="url(#line-chart-area-"]')).not.toBeNull();
    expect(root().querySelector<HTMLElement>('[data-marker]')!.className).toContain('bg-loss');
  });

  it('marks the newest point until another is hovered, then reads that one out', () => {
    fixture = render(LineChartComponent, { points });
    const marker = () => root().querySelector<HTMLElement>('[data-marker]')!;
    expect(marker().style.left).toBe('100%');
    expect(root().querySelector('[data-crosshair]')).toBeNull();
    expect(root().querySelector('p')).toBeNull();

    hoverAt(200);
    expect(text(root().querySelector('p')!)).toBe('$300 · 2 PM');
    expect(root().querySelector<HTMLElement>('[data-crosshair]')!.style.left).toBe('50%');
    expect(marker().style.left).toBe('50%');
    expect(marker().className).toContain('size-2.5');

    // Past either edge the nearest point is read out, anchored so its label stays inside.
    hoverAt(0);
    expect(root().querySelector('p')!.textContent).toContain('1 PM');
    expect(root().querySelector<HTMLElement>('p')!.style.transform).toBe('translateX(0)');
    hoverAt(900);
    expect(root().querySelector<HTMLElement>('p')!.style.transform).toBe('translateX(-100%)');

    plot().dispatchEvent(new MouseEvent('pointerleave'));
    fixture.detectChanges();
    expect(root().querySelector('p')).toBeNull();
    expect(marker().style.left).toBe('100%');
  });

  it('copes with one point, with none, and with a plot that has no width yet', () => {
    fixture = render(LineChartComponent, { points: [points[0]], area: true });
    expect(root().querySelector('[data-line]')!.getAttribute('d')).toBe('M 0.00,38.00');
    expect(root().querySelector('path[fill^="url("]')).toBeNull();
    expect(texts('[data-axis="x"] > span')).toEqual(['1 PM']);
    plot().dispatchEvent(new MouseEvent('pointermove', { clientX: 5 }));
    fixture.detectChanges();
    expect(root().querySelector('p')!.textContent).toContain('1 PM');

    fixture = render(LineChartComponent, { points: [] });
    expect(root().querySelector('[data-line]')!.getAttribute('d')).toBe('');
    expect(root().querySelector('[data-marker]')).toBeNull();
    plot().dispatchEvent(new MouseEvent('pointermove', { clientX: 5 }));
    fixture.detectChanges();
    expect(root().querySelector('p')).toBeNull();
  });

  it('spreads at most five labels over a long range, ending on the newest', () => {
    const month = Array.from({ length: 30 }, (_, index) => ({ value: index, label: `Day ${index + 1}` }));
    fixture = render(LineChartComponent, { points: month });

    expect(texts('[data-axis="x"] > span')).toEqual(['Day 1', 'Day 8', 'Day 16', 'Day 23', 'Day 30']);
  });
});

describe('SparklineComponent', () => {
  const shape = (points: number[]) => {
    const root = render(SparklineComponent, { points }).nativeElement as HTMLElement;
    return { path: root.querySelector('path'), circle: root.querySelector('circle'), root };
  };

  it('draws a rising trend in the gain color with a dot on the newest value', () => {
    const { path, circle } = shape([10, 20, 30]);
    expect(path!.getAttribute('d')).toBe('M0.00,21.00 L50.00,12.00 L100.00,3.00');
    expect(path!.getAttribute('class')).toContain('stroke-gain');
    expect(circle!.getAttribute('cx')).toBe('100');
    expect(circle!.getAttribute('cy')).toBe('3');
  });

  it('draws a falling trend in the loss color', () => {
    expect(shape([30, 10]).path!.getAttribute('class')).toContain('stroke-loss');
  });

  it('draws a single value as a dot and nothing for no values', () => {
    expect(shape([5]).path!.getAttribute('d')).toBe('M0.00,21.00');
    expect(shape([]).root.querySelector('svg')).toBeNull();
  });
});

@Component({
  imports: [DialogComponent],
  template: `
    @if (open()) {
      <app-dialog title="Order #7" [width]="960" closeLabel="Close order detail" (closed)="open.set(false)">
        <p>Body</p>
      </app-dialog>
    }
  `,
})
class DialogHost {
  readonly open = signal(true);
}

describe('DialogComponent', () => {
  let fixture: ComponentFixture<DialogHost>;
  const root = () => fixture.nativeElement as HTMLElement;
  const dialog = () => root().querySelector<HTMLElement>('[role="dialog"]');

  beforeEach(async () => {
    fixture = TestBed.createComponent(DialogHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('is a labelled modal that starts with focus on its close button', () => {
    const title = root().querySelector('h2')!;
    expect(title.textContent).toBe('Order #7');
    expect(dialog()!.getAttribute('aria-modal')).toBe('true');
    expect(dialog()!.getAttribute('aria-labelledby')).toBe(title.id);
    expect(dialog()!.style.maxWidth).toBe('960px');
    expect(dialog()!.textContent).toContain('Body');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close order detail');
  });

  it('closes from its button', () => {
    root().querySelector<HTMLButtonElement>('button[aria-label="Close order detail"]')!.click();
    fixture.detectChanges();
    expect(dialog()).toBeNull();
  });

  it('closes on escape', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(dialog()).toBeNull();
  });

  it('closes on a click on the scrim but not on one inside the card', () => {
    dialog()!.click();
    fixture.detectChanges();
    expect(dialog()).not.toBeNull();

    root().querySelector<HTMLElement>('app-dialog')!.click();
    fixture.detectChanges();
    expect(dialog()).toBeNull();
  });
});

describe('live', () => {
  let load: ReturnType<typeof vi.fn<() => Observable<string>>>;
  let data: Live<string>;

  const start = () =>
    TestBed.runInInjectionContext(() => {
      data = live<string>(() => load(), 1000);
    });

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('loads at once and again on every interval', () => {
    load = vi.fn(() => of('first'));
    start();
    expect(data.state()).toBe('loading');

    vi.advanceTimersByTime(0);
    expect(data.state()).toBe('ready');
    expect(data.data()).toBe('first');

    load.mockReturnValue(of('second'));
    vi.advanceTimersByTime(1000);
    expect(data.data()).toBe('second');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('reports an error when the first load fails and recovers on a reload', () => {
    load = vi.fn(() => throwError(() => new Error('down')));
    start();
    vi.advanceTimersByTime(0);
    expect(data.state()).toBe('error');
    expect(data.data()).toBeNull();

    load.mockReturnValue(of('back'));
    data.reload();
    expect(data.state()).toBe('ready');
    expect(data.data()).toBe('back');
  });

  it('keeps the last good data when a refresh fails', () => {
    load = vi.fn(() => of('good'));
    start();
    vi.advanceTimersByTime(0);

    load.mockReturnValue(throwError(() => new Error('down')));
    vi.advanceTimersByTime(1000);
    expect(data.state()).toBe('ready');
    expect(data.data()).toBe('good');
  });

  it('drops a slow answer when a newer load has started', () => {
    const slow = new Subject<string>();
    load = vi.fn(() => slow);
    start();
    vi.advanceTimersByTime(0);

    load.mockReturnValue(of('new'));
    data.reload();
    slow.next('old');
    expect(data.data()).toBe('new');
  });
});
