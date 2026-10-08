import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DailyCount } from '../reporting/report.models';
import { DailyTradesChartComponent, axisTop } from './daily-trades-chart.component';

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

describe('DailyTradesChartComponent', () => {
  let fixture: ComponentFixture<DailyTradesChartComponent>;

  const render = (days: DailyCount[]) => {
    fixture = TestBed.createComponent(DailyTradesChartComponent);
    fixture.componentRef.setInput('days', days);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  const bars = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>('li'));
  const readout = (root: HTMLElement) =>
    root.querySelector('p')!.textContent!.replace(/\s+/g, ' ').trim();

  it('draws one stacked bar per day against a rounded axis', () => {
    const root = render([
      { date: '2026-10-07', filled: 2, rejected: 1 },
      { date: '2026-10-08', filled: 4, rejected: 0 },
    ]);

    const [first, second] = bars(root);
    expect(first.getAttribute('aria-label')).toBe('Oct 7: 2 filled, 1 rejected');
    const [rejected, filled] = Array.from(first.querySelectorAll<HTMLElement>('span'));
    expect(rejected.style.height).toBe('25%');
    expect(filled.style.height).toBe('50%');
    expect(second.querySelectorAll<HTMLElement>('span')[1].style.height).toBe('100%');
    expect(root.textContent).toContain('Oct 8');
  });

  it('reads out the newest day until another is hovered or focused', () => {
    const root = render([
      { date: '2026-10-07', filled: 2, rejected: 1 },
      { date: '2026-10-08', filled: 4, rejected: 0 },
    ]);
    expect(readout(root)).toBe('Oct 8 · 4 filled · 0 rejected');

    bars(root)[0].dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    expect(readout(root)).toBe('Oct 7 · 2 filled · 1 rejected');

    root.querySelector('ol')!.dispatchEvent(new Event('mouseleave'));
    fixture.detectChanges();
    expect(readout(root)).toBe('Oct 8 · 4 filled · 0 rejected');

    bars(root)[0].dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(readout(root)).toBe('Oct 7 · 2 filled · 1 rejected');

    bars(root)[0].dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(readout(root)).toBe('Oct 8 · 4 filled · 0 rejected');
  });

  it('thins the day labels on a long range and always labels the newest day', () => {
    const days = Array.from({ length: 30 }, (_, index) => ({
      date: `2026-09-${String(index + 1).padStart(2, '0')}`,
      filled: index,
      rejected: 0,
    }));
    const root = render(days);

    const labels = Array.from(root.querySelectorAll('[aria-hidden="true"] > span.flex'))
      .map((label) => label.textContent!.trim());
    expect(labels).toHaveLength(30);
    expect(labels.filter(Boolean)).toHaveLength(6);
    expect(labels[29]).toBe('Sep 30');
  });

  it('says so when no order has resolved', () => {
    const root = render([]);
    expect(root.textContent).toContain('No orders have resolved yet.');
    expect(bars(root)).toHaveLength(0);
  });
});
