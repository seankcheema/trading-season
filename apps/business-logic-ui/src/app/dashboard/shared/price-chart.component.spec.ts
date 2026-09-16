import { TestBed } from '@angular/core/testing';
import { PriceChartComponent } from './price-chart.component';
import { PricePoint, mockPriceSeries } from '../mock-data';
import { TimeframeToggleComponent } from './timeframe-toggle.component';

describe('PriceChartComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PriceChartComponent],
    }).compileComponents();
  });

  function setup(timeframe: '1D' | '5D' | '1Y' = '1D', points?: PricePoint[]) {
    const fixture = TestBed.createComponent(PriceChartComponent);
    fixture.componentRef.setInput('points', points ?? mockPriceSeries('TEST', timeframe, 100));
    fixture.componentRef.setInput('timeframe', timeframe);
    fixture.detectChanges();
    return fixture;
  }

  it('should label the time axis with at most six ticks', () => {
    const component = setup().componentInstance;
    const ticks = component['ticks']();
    expect(ticks.length).toBeGreaterThan(1);
    expect(ticks.length).toBeLessThanOrEqual(6);
    expect(ticks[0].label).toBe('9:30 AM');
  });

  it('should put one tick per trading day on the 5D chart', () => {
    const component = setup('5D').componentInstance;
    expect(component['ticks']().map((tick) => tick.label)).toEqual([
      'Tue 8',
      'Wed 9',
      'Thu 10',
      'Fri 11',
      'Mon 14',
    ]);
  });

  it('should render a right-side value axis with currency labels', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    const ticks = component['yTicks']();
    expect(ticks).toHaveLength(5);
    expect(ticks.every((tick) => tick.label.startsWith('$'))).toBe(true);
    expect(fixture.nativeElement.textContent).toContain(ticks[0].label);
  });

  it('should show the value and time of the hovered point', () => {
    const fixture = setup();
    fixture.componentInstance['hoverIndex'].set(26);
    fixture.detectChanges();
    const hovered = fixture.componentInstance['hovered']();
    expect(hovered?.valueLabel).toBe('$100.00');
    expect(hovered?.timeLabel).toBe('4:00 PM');
    expect(fixture.nativeElement.textContent).toContain('$100.00');
    expect(fixture.nativeElement.querySelector('.price-hover-marker')?.textContent).toContain(
      '$100.00',
    );
  });

  it('should show a current price dot for a single early-session point without hover', () => {
    const fixture = setup('1D', [{ time: new Date('2026-01-01T08:30:00Z'), value: 100 }]);
    const marker: HTMLElement | null = fixture.nativeElement.querySelector('.price-current-marker');
    expect(marker).not.toBeNull();
    expect(marker?.style.left).toBe('50%');
  });

  it('should show a smaller current price dot at the end of the trail', () => {
    const fixture = setup();
    const marker: HTMLElement | null = fixture.nativeElement.querySelector('.price-current-marker');
    expect(marker?.style.left).toBe('100%');
    expect(marker?.classList).toContain('size-2');
    expect(marker?.classList).toContain('z-10');
  });

  it('should show a fallback dot when there are no chart points', () => {
    const fixture = setup('1D', []);
    const marker: HTMLElement | null = fixture.nativeElement.querySelector('.price-current-marker');
    expect(marker).not.toBeNull();
    expect(marker?.style.left).toBe('50%');
    expect(marker?.style.top).toBe('50%');
  });

  it('should keep the tooltip out of the plot and hidden until hovered', () => {
    const fixture = setup();
    const tooltip: HTMLElement = fixture.nativeElement.querySelector('.bg-popover');
    const tooltipLayer = tooltip.parentElement;
    const plot: HTMLElement = fixture.nativeElement.querySelector('[tabindex="0"]');
    expect(plot.contains(tooltip)).toBe(false);
    expect(tooltipLayer?.classList).toContain('absolute');
    expect(tooltipLayer?.classList).toContain('invisible');

    fixture.componentInstance['hoverIndex'].set(3);
    fixture.detectChanges();
    expect(tooltipLayer?.classList).not.toContain('invisible');
  });

  it('should step through points with the arrow keys', () => {
    const fixture = setup();
    const plot: HTMLElement = fixture.nativeElement.querySelector('[tabindex="0"]');
    plot.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(fixture.componentInstance['hoverIndex']()).toBe(25);
    plot.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(fixture.componentInstance['hoverIndex']()).toBe(0);
  });
});

describe('TimeframeToggleComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimeframeToggleComponent],
    }).compileComponents();
  });

  it('should not render the removed 1W timeframe', () => {
    const fixture = TestBed.createComponent(TimeframeToggleComponent);
    fixture.detectChanges();
    const labels = Array.from(fixture.nativeElement.querySelectorAll('button')).map((button) =>
      (button as HTMLButtonElement).textContent?.trim(),
    );
    expect(labels).toEqual(['1D', '5D', '1M', '1Y']);
    expect(fixture.nativeElement.textContent).not.toContain('1W');
  });
});
