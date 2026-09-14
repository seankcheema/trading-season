import { TestBed } from '@angular/core/testing';
import { PriceChartComponent } from './price-chart.component';
import { mockPriceSeries } from '../mock-data';

describe('PriceChartComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PriceChartComponent],
    }).compileComponents();
  });

  function setup(timeframe: '1D' | '5D' | '1Y' = '1D') {
    const fixture = TestBed.createComponent(PriceChartComponent);
    fixture.componentRef.setInput('points', mockPriceSeries('TEST', timeframe, 100));
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

  it('should show the value and time of the hovered point', () => {
    const fixture = setup();
    fixture.componentInstance['hoverIndex'].set(26);
    fixture.detectChanges();
    const hovered = fixture.componentInstance['hovered']();
    expect(hovered?.valueLabel).toBe('$100.00');
    expect(hovered?.timeLabel).toBe('4:00 PM');
    expect(fixture.nativeElement.textContent).toContain('$100.00');
  });

  it('should keep the tooltip out of the plot and hidden until hovered', () => {
    const fixture = setup();
    const tooltip: HTMLElement = fixture.nativeElement.querySelector('.bg-popover');
    const plot: HTMLElement = fixture.nativeElement.querySelector('[tabindex="0"]');
    expect(plot.contains(tooltip)).toBe(false);
    expect(tooltip.classList).toContain('invisible');

    fixture.componentInstance['hoverIndex'].set(3);
    fixture.detectChanges();
    expect(tooltip.classList).not.toContain('invisible');
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
