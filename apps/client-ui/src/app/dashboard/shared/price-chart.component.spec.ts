import { TestBed } from '@angular/core/testing';
import { PriceChartComponent } from './price-chart.component';
import { PricePoint, mockPriceSeries } from '../mock-data';
import { TimeframeToggleComponent } from './timeframe-toggle.component';
import { ChartMode, MarketCandlePoint } from './market-chart.models';

describe('PriceChartComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PriceChartComponent],
    }).compileComponents();
  });

  function setup(timeframe: '1D' | '5D' | '1Y' = '1D', points?: PricePoint[], interactive = false) {
    const fixture = TestBed.createComponent(PriceChartComponent);
    fixture.componentRef.setInput('points', points ?? mockPriceSeries('TEST', timeframe, 100));
    fixture.componentRef.setInput('timeframe', timeframe);
    fixture.componentRef.setInput('interactive', interactive);
    fixture.detectChanges();
    return fixture;
  }

  function setupCandles(mode: ChartMode) {
    const candles: MarketCandlePoint[] = [
      {
        time: new Date('2026-01-01T15:30:00Z'),
        open: 100,
        high: 104,
        low: 98,
        close: 103,
        volume: 100,
      },
      {
        time: new Date('2026-01-01T15:35:00Z'),
        open: 103,
        high: 105,
        low: 99,
        close: 101,
        volume: 180,
      },
      {
        time: new Date('2026-01-01T15:40:00Z'),
        open: 101,
        high: 112,
        low: 100,
        close: 110,
        volume: 140,
      },
    ];
    const fixture = TestBed.createComponent(PriceChartComponent);
    fixture.componentRef.setInput('candles', candles);
    fixture.componentRef.setInput('timeframe', '1D');
    fixture.componentRef.setInput('mode', mode);
    fixture.detectChanges();
    return fixture;
  }

  it('renders line and area paths for the simple trend modes', () => {
    const line = setupCandles('line');
    expect(line.nativeElement.querySelector('.chart-price-line')).not.toBeNull();
    expect(line.nativeElement.querySelector('linearGradient')).toBeNull();

    const area = setupCandles('area');
    expect(area.nativeElement.querySelector('.chart-price-line')).not.toBeNull();
    expect(area.nativeElement.querySelector('linearGradient')).not.toBeNull();
  });

  it('renders candlestick wicks and bodies from OHLC data', () => {
    const fixture = setupCandles('candles');
    expect(fixture.nativeElement.querySelectorAll('.chart-candle')).toHaveLength(3);
    expect(fixture.nativeElement.querySelectorAll('.chart-candle rect')).toHaveLength(3);
  });

  it('renders OHLC open and close ticks', () => {
    const fixture = setupCandles('ohlc');
    expect(fixture.nativeElement.querySelectorAll('.ohlc-open-tick')).toHaveLength(3);
    expect(fixture.nativeElement.querySelectorAll('.ohlc-close-tick')).toHaveLength(3);
  });

  it('renders volume as the primary graph without a price line', () => {
    const fixture = setupCandles('volume');
    const heights = fixture.componentInstance['volumeBars']().map((bar) => bar.height);
    expect(fixture.nativeElement.querySelectorAll('.chart-volume-bar')).toHaveLength(3);
    expect(fixture.nativeElement.querySelector('.chart-price-line')).toBeNull();
    expect(Math.max(...heights)).toBeGreaterThan(30);
  });

  it('normalizes percent mode to zero and formats the axis as percentages', () => {
    const fixture = setupCandles('percent');
    const points = fixture.componentInstance['visiblePoints']();
    expect(points[0].value).toBe(0);
    expect(points[2].value).toBeCloseTo(6.8, 1);
    expect(fixture.componentInstance['yTicks']().every((tick) => tick.label.endsWith('%'))).toBe(
      true,
    );
  });

  it('updates the rendered graph whenever the mode input changes', () => {
    const fixture = setupCandles('line');
    const svg = () => fixture.nativeElement.querySelector('svg') as SVGElement;

    expect(svg().dataset['chartMode']).toBe('line');
    expect(fixture.nativeElement.querySelector('.chart-price-line')).not.toBeNull();

    fixture.componentRef.setInput('mode', 'area');
    fixture.detectChanges();
    expect(svg().dataset['chartMode']).toBe('area');
    expect(fixture.nativeElement.querySelector('linearGradient')).not.toBeNull();

    fixture.componentRef.setInput('mode', 'candles');
    fixture.detectChanges();
    expect(svg().dataset['chartMode']).toBe('candles');
    expect(fixture.nativeElement.querySelector('.chart-candle rect')).not.toBeNull();

    fixture.componentRef.setInput('mode', 'ohlc');
    fixture.detectChanges();
    expect(svg().dataset['chartMode']).toBe('ohlc');
    expect(fixture.nativeElement.querySelector('.ohlc-open-tick')).not.toBeNull();

    fixture.componentRef.setInput('mode', 'volume');
    fixture.detectChanges();
    expect(svg().dataset['chartMode']).toBe('volume');
    expect(fixture.nativeElement.querySelector('.chart-price-line')).toBeNull();
    expect(
      Math.max(...fixture.componentInstance['volumeBars']().map((bar) => bar.height)),
    ).toBeGreaterThan(30);

    fixture.componentRef.setInput('mode', 'percent');
    fixture.detectChanges();
    expect(svg().dataset['chartMode']).toBe('percent');
    expect(fixture.componentInstance['yTicks']().every((tick) => tick.label.endsWith('%'))).toBe(
      true,
    );
  });

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

  it('should label the time axis on round clock boundaries', () => {
    const component = setup().componentInstance;
    component['_plotWidth'].set(900);
    expect(component['ticks']().map((tick) => tick.label)).toEqual([
      '9:30 AM',
      '10:00 AM',
      '12:00 PM',
      '2:00 PM',
      '4:00 PM',
    ]);
  });

  it('should widen the time axis to fit a narrow chart rather than overlap labels', () => {
    const component = setup().componentInstance;
    // The order ticket puts the chart in a column far narrower than the viewport, so the
    // fit has to be decided from the plot's own width. The 9:30 open is the odd label out
    // and goes first, leaving a clean two-hour axis.
    component['_plotWidth'].set(350);
    const narrow = component['ticks']();
    expect(narrow.map((tick) => tick.label)).toEqual([
      '10:00 AM',
      '12:00 PM',
      '2:00 PM',
      '4:00 PM',
    ]);
    expect(component['labelsCollide'](narrow)).toBe(false);
  });

  it('should render a right-side value axis with currency labels', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    const ticks = component['yTicks']();
    expect(ticks).toHaveLength(5);
    expect(ticks.every((tick) => tick.label.startsWith('$'))).toBe(true);
    expect(fixture.nativeElement.textContent).toContain(ticks[0].label);
  });

  it('should show the latest price on the right axis when enabled', () => {
    const fixture = setup('1D', [
      { time: new Date('2026-01-01T15:30:00Z'), value: 100 },
      { time: new Date('2026-01-01T15:35:00Z'), value: 102.34 },
    ]);
    expect(fixture.nativeElement.querySelector('.current-price-axis-label')).toBeNull();

    fixture.componentRef.setInput('showCurrentPrice', true);
    fixture.detectChanges();

    const label: HTMLElement = fixture.nativeElement.querySelector('.current-price-axis-label');
    expect(label.textContent?.trim()).toBe('$102.34');
    expect(label.classList).toContain('current-price-gain');
    expect(fixture.componentInstance['currentPriceMarker']()?.svgY).toBeGreaterThanOrEqual(0);
  });

  it('should make clustered candle volumes visibly different', () => {
    const component = setup('1D', [
      { time: new Date('2026-01-01T15:30:00Z'), value: 100, volume: 100 },
      { time: new Date('2026-01-01T15:35:00Z'), value: 101, volume: 105 },
      { time: new Date('2026-01-01T15:40:00Z'), value: 99, volume: 110 },
    ]).componentInstance;

    const heights = component['volumeBars']().map((bar) => bar.height);
    expect(new Set(heights).size).toBe(3);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(6);
  });

  it('should show the value and time of the hovered point', () => {
    const fixture = setup();
    fixture.componentInstance['hoverIndex'].set(26);
    fixture.detectChanges();
    const hovered = fixture.componentInstance['hovered']();
    expect(hovered?.valueLabel).toBe('$100.00');
    expect(hovered?.timeLabel).toBe('4:00 PM');
    expect(fixture.nativeElement.textContent).toContain('$100.00');
    expect(fixture.nativeElement.querySelector('.price-hover-label')?.textContent).toContain(
      '$100.00',
    );
  });

  it('should align the hover label with the point and keep it above the plot', () => {
    const fixture = setup();
    fixture.componentInstance['hoverIndex'].set(13);
    fixture.detectChanges();
    const label: HTMLElement = fixture.nativeElement.querySelector('.price-hover-label');
    const point = fixture.componentInstance['hovered']();
    // The label shares the plot's grid column, so a matching left offset puts it on the
    // point's vertical axis, and its row sits above the plot at a constant height.
    expect(label.style.left).toBe(`${point?.x}%`);
    expect(label.style.top).toBe('');
    expect(label.classList).toContain('top-0');
    const plot: HTMLElement = fixture.nativeElement.querySelector('[tabindex="0"]');
    expect(plot.contains(label)).toBe(false);
    expect(label.parentElement?.nextElementSibling).toBe(plot.previousElementSibling);
  });

  it('should not draw a horizontal crosshair or a value-axis price on hover', () => {
    const fixture = setup();
    fixture.componentInstance['hoverIndex'].set(13);
    fixture.detectChanges();
    const plot: HTMLElement = fixture.nativeElement.querySelector('[tabindex="0"]');
    expect(plot.querySelector('.inset-x-0')).toBeNull();
    expect(plot.querySelector('.inset-y-0')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.price-hover-marker')).toBeNull();
  });

  it('should show a horizontal trace and latest marker for a single early-session point', () => {
    const fixture = setup('1D', [{ time: new Date('2026-01-01T08:30:00Z'), value: 100 }]);
    const marker: HTMLElement | null = fixture.nativeElement.querySelector('.price-current-marker');
    expect(marker).not.toBeNull();
    expect(marker?.style.left).toBe('100%');
    expect(fixture.componentInstance['linePath']()).toMatch(/^M 0,.* L 100,/);
  });

  it('should show a smaller current price dot at the end of the trail', () => {
    const fixture = setup();
    const marker: HTMLElement | null = fixture.nativeElement.querySelector('.price-current-marker');
    expect(marker?.style.left).toBe('100%');
    expect(marker?.classList).toContain('size-2');
    expect(marker?.classList).toContain('z-10');
  });

  it('should not show a misleading fallback dot when there are no chart points', () => {
    const fixture = setup('1D', []);
    const marker: HTMLElement | null = fixture.nativeElement.querySelector('.price-current-marker');
    expect(marker).toBeNull();
  });

  it('should keep the hover label out of the plot and hidden until hovered', () => {
    const fixture = setup();
    const label: HTMLElement = fixture.nativeElement.querySelector('.price-hover-label');
    const plot: HTMLElement = fixture.nativeElement.querySelector('[tabindex="0"]');
    expect(plot.contains(label)).toBe(false);
    expect(label.classList).toContain('absolute');
    expect(label.classList).toContain('invisible');

    fixture.componentInstance['hoverIndex'].set(3);
    fixture.detectChanges();
    expect(label.classList).not.toContain('invisible');
  });

  it('should step through points with the arrow keys', () => {
    const fixture = setup();
    const plot: HTMLElement = fixture.nativeElement.querySelector('[tabindex="0"]');
    plot.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(fixture.componentInstance['hoverIndex']()).toBe(25);
    plot.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(fixture.componentInstance['hoverIndex']()).toBe(0);
  });

  it('should zoom and return to the latest bars', () => {
    const points = Array.from({ length: 120 }, (_, index) => ({
      time: new Date(2026, 0, 1, 9, index),
      value: 100 + index,
    }));
    const component = setup('1D', points, true).componentInstance;
    expect(component['visiblePoints']()).toHaveLength(78);
    component['zoom'](0.8);
    expect(component['visiblePoints']().length).toBeLessThan(78);
    component['pan'](-0.5);
    expect(component['atLatest']()).toBe(false);
    component['goLatest']();
    expect(component['atLatest']()).toBe(true);
  });

  it('should preserve the original full-series chart when interaction is disabled', () => {
    const points = Array.from({ length: 120 }, (_, index) => ({
      time: new Date(2026, 0, 1, 9, index),
      value: 100 + index,
    }));
    const fixture = setup('1D', points);
    expect(fixture.componentInstance['visiblePoints']()).toHaveLength(120);
    expect(fixture.nativeElement.querySelector('[aria-label="Zoom in"]')).toBeNull();
  });

  it('should reset an interactive view when its interaction key changes', () => {
    const points = Array.from({ length: 120 }, (_, index) => ({
      time: new Date(2026, 0, 1, 9, index),
      value: 100 + index,
    }));
    const fixture = setup('1D', points, true);
    fixture.componentInstance['pan'](-0.5);
    expect(fixture.componentInstance['atLatest']()).toBe(false);
    fixture.componentRef.setInput('interactionKey', 'MSFT');
    fixture.detectChanges();
    expect(fixture.componentInstance['atLatest']()).toBe(true);
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
