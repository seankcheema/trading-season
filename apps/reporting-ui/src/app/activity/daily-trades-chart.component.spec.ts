import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DailyCount } from '../reporting/report.models';
import { DailyTradesChartComponent, axisTop, smoothPath } from './daily-trades-chart.component';

describe('axisTop', () => {
  it.each([
    [0, 2],
    [2, 2],
    [3, 4],
    [5, 6],
    [9, 10],
    [37, 40],
    [450, 500],
  ])('rounds %i up to %i', (max, top) => {
    expect(axisTop(max)).toBe(top);
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

describe('DailyTradesChartComponent', () => {
  let fixture: ComponentFixture<DailyTradesChartComponent>;

  const render = (days: DailyCount[]) => {
    fixture = TestBed.createComponent(DailyTradesChartComponent);
    fixture.componentRef.setInput('days', days);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  const days = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>('li'));
  const readout = (root: HTMLElement) =>
    root.querySelector('p')!.textContent!.replace(/\s+/g, ' ').trim();
  const series = (root: HTMLElement, name: string) =>
    root.querySelector(`path[data-series="${name}"]`)!.getAttribute('d')!;
  const axis = (root: HTMLElement) =>
    Array.from(root.querySelectorAll('[aria-hidden="true"] > span.absolute')).map((tick) =>
      tick.textContent!.trim(),
    );

  it('draws a filled and a rejected line against a rounded count axis', () => {
    const root = render([
      { date: '2026-10-07', filled: 2, rejected: 1 },
      { date: '2026-10-08', filled: 4, rejected: 0 },
    ]);

    // Each day is centered in its half of the plot; 4 is the top of the axis.
    expect(series(root, 'filled')).toMatch(/^M 25\.00,20\.00 C .* 75\.00,0\.00$/);
    expect(series(root, 'rejected')).toMatch(/^M 25\.00,30\.00 C .* 75\.00,40\.00$/);
    expect(axis(root)).toEqual(expect.arrayContaining(['4', '2', '0', 'Oct 7', 'Oct 8']));
    expect(days(root)[0].getAttribute('aria-label')).toBe('Oct 7: 2 filled, 1 rejected');
    expect(root.querySelector('path[fill^="url(#daily-trades-area-"]')).not.toBeNull();
  });

  it('reads out the newest day until another is hovered or focused', () => {
    const root = render([
      { date: '2026-10-07', filled: 2, rejected: 1 },
      { date: '2026-10-08', filled: 4, rejected: 0 },
    ]);
    expect(readout(root)).toBe('Oct 8 · 4 filled · 0 rejected');
    expect(root.querySelector('[data-crosshair]')).toBeNull();

    days(root)[0].dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    expect(readout(root)).toBe('Oct 7 · 2 filled · 1 rejected');
    expect(root.querySelector<HTMLElement>('[data-crosshair]')!.style.left).toBe('25%');

    root.querySelector('ol')!.dispatchEvent(new Event('mouseleave'));
    fixture.detectChanges();
    expect(readout(root)).toBe('Oct 8 · 4 filled · 0 rejected');

    days(root)[0].dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(readout(root)).toBe('Oct 7 · 2 filled · 1 rejected');

    days(root)[0].dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(readout(root)).toBe('Oct 8 · 4 filled · 0 rejected');
  });

  it('centers a single day and draws no area under it', () => {
    const root = render([{ date: '2026-10-08', filled: 3, rejected: 1 }]);

    expect(series(root, 'filled')).toBe('M 50.00,10.00');
    expect(root.querySelector('path[fill^="url("]')).toBeNull();
    expect(readout(root)).toBe('Oct 8 · 3 filled · 1 rejected');
  });

  it('thins the day labels on a long range and always labels the newest day', () => {
    const range = Array.from({ length: 30 }, (_, index) => ({
      date: `2026-09-${String(index + 1).padStart(2, '0')}`,
      filled: index,
      rejected: 0,
    }));
    const root = render(range);

    const labels = Array.from(root.querySelectorAll('[data-axis="days"] > span')).map((label) =>
      label.textContent!.trim(),
    );
    expect(labels).toHaveLength(6);
    expect(labels[5]).toBe('Sep 30');
    expect(days(root)).toHaveLength(30);
  });

  it('says so when no order has resolved', () => {
    const root = render([]);
    expect(root.textContent).toContain('No orders have resolved yet.');
    expect(days(root)).toHaveLength(0);
  });
});
