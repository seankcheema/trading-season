import { TestBed } from '@angular/core/testing';
import { PricePoint } from '../mock-data';
import { DailySparklineComponent } from './daily-sparkline.component';

describe('DailySparklineComponent', () => {
  const POINTS: PricePoint[] = [
    { time: new Date('2026-01-05T14:30:00Z'), value: 100 },
    { time: new Date('2026-01-05T15:30:00Z'), value: 104 },
    { time: new Date('2026-01-05T16:30:00Z'), value: 102 },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DailySparklineComponent],
    }).compileComponents();
  });

  function setup(points: PricePoint[] = POINTS, symbol = 'AAPL') {
    const fixture = TestBed.createComponent(DailySparklineComponent);
    fixture.componentRef.setInput('symbol', symbol);
    fixture.componentRef.setInput('points', points);
    fixture.detectChanges();
    return fixture;
  }

  it('should render a line path for daily points', () => {
    const fixture = setup();
    const path = fixture.nativeElement.querySelector('[data-testid="sparkline-path"]');

    expect(path).not.toBeNull();
    expect(path.getAttribute('d')).toContain('M');
    expect(path.getAttribute('d')).toContain('L');
  });

  it('should render the opening baseline', () => {
    const fixture = setup();
    const baseline = fixture.nativeElement.querySelector('[data-testid="sparkline-baseline"]');

    expect(baseline).not.toBeNull();
    expect(baseline.getAttribute('stroke-dasharray')).toBe('3 3');
  });

  it('should color the line by the latest value versus baseline', () => {
    const gain = setup().nativeElement.querySelector('[data-testid="sparkline-path"]');
    const loss = setup([
      { time: new Date('2026-01-05T14:30:00Z'), value: 100 },
      { time: new Date('2026-01-05T15:30:00Z'), value: 96 },
    ]).nativeElement.querySelector('[data-testid="sparkline-path"]');

    expect(gain.classList).toContain('stroke-gain');
    expect(loss.classList).toContain('stroke-loss');
  });

  it('should render a fallback empty state without a line path', () => {
    const fixture = setup([]);
    const chart = fixture.nativeElement.querySelector('[role="img"]');

    expect(fixture.nativeElement.querySelector('[data-testid="sparkline-baseline"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="sparkline-path"]')).toBeNull();
    expect(chart.getAttribute('aria-label')).toBe('AAPL today chart, no data');
  });
});
