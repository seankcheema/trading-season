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

  it('tracks the plot size reported by a ResizeObserver and disconnects it on destroy', async () => {
    let report: ResizeObserverCallback = () => undefined;
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          report = callback;
        }
        observe = observe;
        disconnect = disconnect;
      },
    );
    try {
      const fixture = setup();
      await fixture.whenStable();
      expect(observe).toHaveBeenCalledTimes(1);

      report(
        [{ contentRect: { width: 480, height: 240 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );

      expect(fixture.componentInstance['_plotWidth']()).toBe(480);
      expect(fixture.componentInstance['_plotHeight']()).toBe(240);
      fixture.destroy();
      expect(disconnect).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps the daily right edge at session close and places the current sample inside the domain', () => {
    const open = Date.parse('2026-01-05T14:30:00Z'),
      close = Date.parse('2026-01-05T21:00:00Z');
    const fixture = setup('1D', [
      { time: new Date(open), value: 100 },
      { time: new Date((open + close) / 2), value: 110 },
    ]);
    fixture.componentRef.setInput('timeDomain', { start: open, end: close });
    fixture.componentRef.setInput('curveMode', 'monotone');
    fixture.detectChanges();
    const path = fixture.nativeElement.querySelector('.chart-price-line').getAttribute('d');
    expect(path).toContain('50.0000,');
    const ticks = fixture.componentInstance['ticks']();
    expect(ticks[0].x).toBe(0);
    expect(ticks.at(-1)?.x).toBe(100);
  });

  it('thins five-session labels on narrow screens independently of sparse values', () => {
    const sessions = Array.from({ length: 5 }, (_, i) => ({
      start: Date.UTC(2026, 0, 5 + i, 14, 30),
      end: Date.UTC(2026, 0, 5 + i, 21),
    }));
    const fixture = setup('5D', [{ time: new Date(sessions[4].start), value: 100 }]);
    fixture.componentRef.setInput('timeDomain', {
      start: sessions[0].start,
      end: sessions[4].end,
      sessions,
    });
    fixture.componentInstance['_plotWidth'].set(200);
    fixture.detectChanges();
    const ticks = fixture.componentInstance['ticks']();
    expect(ticks).toHaveLength(3);
    expect(ticks.map((tick) => Math.round(tick.x))).toEqual([10, 50, 90]);
  });

  it('separates rapid trades, preserves values and times, and follows plot resizing', () => {
    const points: PricePoint[] = [
      { time: new Date(0), value: 1000 },
      { time: new Date(49999), value: 1000 },
      { time: new Date(50000), value: 100, transition: true },
      { time: new Date(50001), value: 100 },
      { time: new Date(50002), value: 1200, transition: true },
    ];
    const fixture = setup('1D', points);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('timeDomain', { start: 0, end: 100000 });
    fixture.componentRef.setInput('curveMode', 'monotone');
    const labels = points.map((_, index) => component['describePoint'](index)?.timeLabel);
    fixture.componentRef.setInput('minimumTransitionSpacingPx', 8);
    component['_plotWidth'].set(400);
    fixture.detectChanges();
    const coords = component['_coords']();
    expect(coords.at(-1)?.x).toBeCloseTo(50.002);
    for (let i = 2; i < coords.length; i++)
      expect((coords[i].x - coords[i - 1].x) * 4).toBeCloseTo(8);
    expect(component['linePath']()).toContain('L');
    const plot = {
      getBoundingClientRect: () => ({ left: 0, width: 400 }),
    } as HTMLElement;
    coords.forEach((coord, index) => {
      component['onPointerMove']({ clientX: coord.x * 4 } as PointerEvent, plot);
      expect(component['hoverIndex']()).toBe(index);
      expect(component['hovered']()?.valueLabel).toBe(
        component['formatValue'](points[index].value),
      );
      expect(component['hovered']()?.timeLabel).toBe(labels[index]);
    });
    component['_plotWidth'].set(800);
    fixture.detectChanges();
    const resized = component['_coords']();
    expect((resized[2].x - resized[1].x) * 8).toBeCloseTo(8);
    expect(component['ticks']().at(-1)?.x).toBe(100);
    fixture.componentRef.setInput('minimumTransitionSpacingPx', 0);
    fixture.detectChanges();
    expect(component['_coords']()[2].x).toBe(50);
    expect(component['visiblePoints']()).toEqual(points);
  });

  it('shows one recorded observation as a marker without inventing a horizontal history', () => {
    const fixture = setup('1D', [{ time: new Date('2026-10-01T18:00:00Z'), value: 100 }]);
    fixture.componentRef.setInput('observationIntervalMs', 60_000);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.price-current-marker')).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('.chart-price-line').getAttribute('d'),
    ).not.toContain('L');
  });

  it('positions observations by elapsed time and connects them into a line', () => {
    const fixture = setup('1D', [
      { time: new Date('2026-10-01T18:00:00Z'), value: 100 },
      { time: new Date('2026-10-01T18:01:00Z'), value: 101 },
      { time: new Date('2026-10-01T18:10:00Z'), value: 110 },
    ]);
    fixture.componentRef.setInput('observationIntervalMs', 60_000);
    fixture.detectChanges();
    const path = fixture.nativeElement.querySelector('.chart-price-line').getAttribute('d');
    expect(path).toMatch(/M 0\.00,.* L 10\.00,.* L 100\.00,/);
  });

  function setupIndicatorCandles(length = 40, interactive = false) {
    const candles = Array.from({ length }, (_, index): MarketCandlePoint => {
      const close = 100 + index + Math.sin(index / 2);
      return {
        time: new Date(Date.UTC(2026, 0, 1, 14, index)),
        open: close - 0.5,
        high: close + 1,
        low: close - 1,
        close,
        volume: 100 + index,
      };
    });
    const fixture = TestBed.createComponent(PriceChartComponent);
    fixture.componentRef.setInput('candles', candles);
    fixture.componentRef.setInput('timeframe', '1D');
    fixture.componentRef.setInput('interactive', interactive);
    fixture.componentRef.setInput('enabledIndicators', ['sma', 'ema', 'bollinger', 'rsi']);
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

  it('renders enabled moving-average overlays and the RSI pane', () => {
    const fixture = setupIndicatorCandles();
    expect(fixture.nativeElement.querySelector('.chart-indicator-sma')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.chart-indicator-ema')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.chart-indicator-bollinger')).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('.chart-bollinger-area')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.chart-indicator-key').textContent).toContain(
      'Bollinger 20 · 2σ',
    );
    expect(fixture.nativeElement.querySelector('.rsi-pane')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.rsi-guide')).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('.rsi-line')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('RSI 14');
  });

  it('keeps indicators hidden until they are enabled', () => {
    const fixture = setupCandles('line');
    expect(fixture.nativeElement.querySelector('.chart-indicator-line')).toBeNull();
    expect(fixture.nativeElement.querySelector('.rsi-pane')).toBeNull();
  });

  it('shows real indicators for a short candle series', () => {
    const fixture = setupIndicatorCandles(10);
    expect(fixture.nativeElement.querySelector('.chart-indicator-line')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.rsi-line')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Demo');
    expect(fixture.componentInstance['latestRsi']()).toBeGreaterThanOrEqual(0);
  });

  it('draws all indicators for the first candle', () => {
    const fixture = setupIndicatorCandles(1);
    expect(fixture.nativeElement.querySelectorAll('.chart-indicator-line')).toHaveLength(4);
    expect(fixture.nativeElement.querySelector('.rsi-line')).not.toBeNull();
    expect(fixture.componentInstance['latestRsi']()).toBe(50);
  });

  it('hides comparison badges without hiding indicators', () => {
    const fixture = setupIndicatorCandles();
    fixture.componentRef.setInput('showIndicatorLabels', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.chart-indicator-key')).toBeNull();
    expect(fixture.nativeElement.querySelector('.chart-indicator-sma')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.rsi-pane')).not.toBeNull();
  });

  it('keeps indicator paths on the same visible range while zooming', () => {
    const fixture = setupIndicatorCandles(120, true);
    const component = fixture.componentInstance;
    expect(component['visiblePoints']()).toHaveLength(78);
    component['zoom'](0.5);
    fixture.detectChanges();
    expect(component['visiblePoints']()).toHaveLength(39);
    expect(
      component['indicatorSvgCoords'](component['smaSeries'](), component['yScale']()).length,
    ).toBeLessThanOrEqual(39);
    expect(fixture.nativeElement.querySelector('.rsi-line')).not.toBeNull();
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

  it('compares portfolio hover values with the first invested value after zero baselines', () => {
    const fixture = setup('1Y', [
      { time: new Date('2025-01-01'), value: 0 },
      { time: new Date('2025-02-01'), value: 0 },
      { time: new Date('2025-03-01'), value: 200 },
      { time: new Date('2025-04-01'), value: 300 },
      { time: new Date('2025-05-01'), value: 100 },
    ]);
    const component = fixture.componentInstance;
    expect(component['describePoint'](3)?.changePercent).toBe(0);
    fixture.componentRef.setInput('changeBaseline', 'first-positive');
    fixture.detectChanges();
    for (const [index, expected] of [
      [2, 0],
      [3, 50],
      [4, -50],
    ]) {
      component['hoverIndex'].set(index);
      fixture.detectChanges();
      expect(component['hovered']()?.changePercent).toBe(expected);
      expect(fixture.nativeElement.querySelector('.price-hover-label').textContent).toContain(
        `${expected >= 0 ? '+' : ''}${expected.toFixed(2)}%`,
      );
    }
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

  it('should position the tooltip cursor-adjacent to the hovered point', () => {
    const fixture = setup();
    fixture.componentInstance['hoverIndex'].set(13);
    fixture.detectChanges();
    const tooltip: HTMLElement = fixture.nativeElement.querySelector('.price-hover-label');
    const pos = fixture.componentInstance['tooltipPosition']();
    const point = fixture.componentInstance['hovered']();

    // Tooltip should be positioned based on x and y coordinates of the point
    expect(tooltip.style.left).toBe(`${pos?.left}%`);
    expect(tooltip.style.top).toBe(`${pos?.top}%`);
    expect(pos?.left).toBeGreaterThan(0);
    expect(pos?.top).toBeGreaterThan(0);
  });

  it('should flip tooltip left when point is near right edge', () => {
    const fixture = setup();
    // Set hover index to a point near the end (right side) of the chart
    fixture.componentInstance['hoverIndex'].set(
      fixture.componentInstance['visiblePoints']().length - 1,
    );
    fixture.detectChanges();
    const pos = fixture.componentInstance['tooltipPosition']();

    // Tooltip should flip left when near right edge
    if (pos!.left > 80) {
      expect(pos?.flipLeft).toBe(true);
    }
  });

  it('should flip tooltip top when point is near top edge', () => {
    const fixture = setup('1D', [
      { time: new Date('2026-01-01T15:30:00Z'), value: 200 },
      { time: new Date('2026-01-01T15:35:00Z'), value: 205 },
    ]);
    fixture.componentInstance['hoverIndex'].set(1);
    fixture.detectChanges();
    const pos = fixture.componentInstance['tooltipPosition']();

    // When point is near top, tooltip should flip down
    if (pos!.top < 25) {
      expect(pos?.flipTop).toBe(true);
    }
  });

  it('should pin a top-placed tooltip to the top of the plot, centered over the hovered point', () => {
    const fixture = setup();
    fixture.componentRef.setInput('tooltipPlacement', 'top');
    const hovered = (index: number) => {
      fixture.componentInstance['hoverIndex'].set(index);
      fixture.detectChanges();
      return {
        pos: fixture.componentInstance['tooltipPosition'](),
        point: fixture.componentInstance['hovered'](),
        tooltip: fixture.nativeElement.querySelector('.price-hover-label') as HTMLElement,
      };
    };

    const middle = hovered(13);
    expect(middle.pos?.top).toBe(0);
    expect(middle.pos?.left).toBe(middle.point?.x);
    expect(middle.tooltip.classList).toContain('-translate-x-1/2');
    expect(middle.tooltip.classList).toContain('translate-y-0');

    // Vertical position does not follow the value, and edges keep the label inside the plot.
    const first = hovered(0);
    const last = hovered(fixture.componentInstance['visiblePoints']().length - 1);
    expect(first.pos?.top).toBe(0);
    expect(last.pos?.top).toBe(0);
    expect(first.pos!.left).toBeGreaterThan(0);
    expect(last.pos!.left).toBeLessThan(100);
  });

  it('should move a top-placed tooltip beside a point that it would otherwise cover', () => {
    const points = [100, 140, 200, 140, 100, 120, 100].map((value, index) => ({
      time: new Date(2026, 0, 1, 9, index * 10),
      value,
    }));
    const fixture = setup('1D', points);
    fixture.componentRef.setInput('tooltipPlacement', 'top');
    fixture.componentInstance['_plotWidth'].set(600);
    fixture.componentInstance['_plotHeight'].set(300);
    fixture.componentInstance['_labelSize'].set({ width: 150, height: 72 });
    const place = (index: number) => {
      fixture.componentInstance['hoverIndex'].set(index);
      fixture.detectChanges();
      return {
        pos: fixture.componentInstance['tooltipPosition'](),
        point: fixture.componentInstance['hovered']()!,
      };
    };

    // A point near the bottom has room above it: centered over it.
    const low = place(4);
    expect(low.point.y).toBeGreaterThan(50);
    expect(low.pos).toMatchObject({ top: 0, centered: true });

    // The peak is closer to the top than the label is tall: the label goes to its right, at
    // the same height, instead of sitting on it.
    const peak = place(2);
    expect((peak.point.y / 100) * 300).toBeLessThan(82);
    expect(peak.pos?.top).toBe(0);
    expect(peak.pos?.centered).toBeFalsy();
    expect(peak.pos?.flipLeft).toBe(false);
    expect(peak.pos!.left).toBeGreaterThan(peak.point.x);

    // Near the right edge it goes to the left of the point instead.
    fixture.componentInstance['_plotWidth'].set(200);
    const crowded = place(2);
    expect(crowded.pos?.flipLeft).toBe(true);
    expect(crowded.pos!.left).toBeLessThan(crowded.point.x);
  });

  it('should render tooltip inside the plot as descendant', () => {
    const fixture = setup();
    fixture.componentInstance['hoverIndex'].set(13);
    fixture.detectChanges();
    const tooltip: HTMLElement = fixture.nativeElement.querySelector('.price-hover-label');
    const plot: HTMLElement = fixture.nativeElement.querySelector('[tabindex="0"]');

    // Tooltip should be inside the plot div
    expect(plot.contains(tooltip)).toBe(true);
  });

  it('should keep chart controls in the toolbar above the plot when interactive', () => {
    const points = Array.from({ length: 120 }, (_, index) => ({
      time: new Date(2026, 0, 1, 9, index),
      value: 100 + index,
    }));
    const fixture = setup('1D', points, true);
    const controlsContainer: HTMLElement = fixture.nativeElement
      .querySelector('[aria-label="Zoom out"]')
      ?.closest('div');

    expect(controlsContainer?.classList).toContain('chart-control-bar');
    expect(controlsContainer?.classList).not.toContain('absolute');
    expect(controlsContainer?.parentElement?.classList).toContain('chart-toolbar');
    expect(fixture.nativeElement.querySelector('[aria-label="Zoom out"]')).not.toBeNull();
  });

  it('should not show controls when chart is not interactive', () => {
    const fixture = setup();
    expect(fixture.nativeElement.querySelector('[aria-label="Zoom out"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.chart-control')).toBeNull();
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

  it('should keep the tooltip hidden until hovered', () => {
    const fixture = setup();
    const tooltip: HTMLElement = fixture.nativeElement.querySelector('.price-hover-label');
    const plot: HTMLElement = fixture.nativeElement.querySelector('[tabindex="0"]');
    expect(plot.contains(tooltip)).toBe(true);
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

  it('keeps live tailing as a named toggle in the navigation bar and offers a Forecast button on request', () => {
    const fixture = setup('1D', undefined, true);
    fixture.componentRef.setInput('showLiveTailing', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const tailing = el.querySelector('[aria-label="Live tailing"]') as HTMLButtonElement;
    expect(tailing.closest('.chart-control-bar')).not.toBeNull();
    expect(tailing.getAttribute('aria-pressed')).toBe('false');
    tailing.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.liveTailing()).toBe(true);
    expect(tailing.getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelector('.forecast-toggle')).toBeNull();

    const toggles: number[] = [];
    fixture.componentInstance.forecastToggle.subscribe(() => toggles.push(1));
    fixture.componentRef.setInput('showForecast', true);
    fixture.detectChanges();
    const forecast = el.querySelector('.forecast-toggle') as HTMLButtonElement;
    expect(forecast.textContent?.trim()).toBe('Forecast');
    // Dua, which the button opens, does not take its click for one outside that closes it.
    expect(forecast.hasAttribute('data-opens-dua')).toBe(true);
    expect(forecast.getAttribute('aria-pressed')).toBe('false');
    forecast.click();
    expect(toggles).toHaveLength(1);
    fixture.componentRef.setInput('forecastOpen', true);
    fixture.detectChanges();
    expect(forecast.getAttribute('aria-pressed')).toBe('true');
  });

  it('tails incoming bars at the current zoom only while enabled', () => {
    const points = Array.from({ length: 120 }, (_, index) => ({
      time: new Date(2026, 0, 1, 9, index),
      value: 100 + index,
    }));
    const fixture = setup('1D', points, true);
    const chart = fixture.componentInstance;
    chart['zoom'](0.8);
    chart['pan'](-0.5);
    const count = chart['viewCount']();
    fixture.componentRef.setInput('liveTailing', true);
    fixture.detectChanges();
    expect(chart['atLatest']()).toBe(true);
    const next = { time: new Date(2026, 0, 1, 11, 1), value: 230 };
    fixture.componentRef.setInput('points', [...points, next]);
    fixture.detectChanges();
    expect(chart['visiblePoints']().at(-1)).toEqual(next);
    expect(chart['viewCount']()).toBe(count);
    fixture.componentRef.setInput('liveTailing', false);
    fixture.detectChanges();
    const start = chart['viewStart']();
    fixture.componentRef.setInput('points', [...points, next, { ...next, value: 231 }]);
    fixture.detectChanges();
    expect(chart['viewStart']()).toBe(start);
    expect(chart['visiblePoints']().at(-1)).toEqual(next);
    expect(chart['atLatest']()).toBe(false);
  });

  it.each(['buttons', 'drag', 'wheel'])(
    'disables live tailing after panning back with %s',
    (method) => {
      const points = Array.from({ length: 120 }, (_, index) => ({
        time: new Date(2026, 0, 1, 9, index),
        value: 100 + index,
      }));
      const fixture = setup('1D', points, true);
      const chart = fixture.componentInstance;
      fixture.componentRef.setInput('liveTailing', true);
      fixture.detectChanges();
      const plot = fixture.nativeElement.querySelector('[role="group"]') as HTMLElement;
      vi.spyOn(plot, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        width: 400,
        top: 0,
        height: 200,
      } as DOMRect);
      if (method === 'buttons') {
        chart['pan'](-0.25);
      } else if (method === 'drag') {
        chart['onPointerDown']({ clientX: 100, pointerId: 1 } as PointerEvent, plot);
        expect(chart.liveTailing()).toBe(true);
        chart['onPointerMove']({ clientX: 200 } as PointerEvent, plot);
        chart['onPointerUp']({ pointerId: 1 } as PointerEvent, plot);
      } else {
        chart['onWheel'](new WheelEvent('wheel', { deltaX: -100, deltaY: 0, clientX: 200 }), plot);
      }
      fixture.detectChanges();
      expect(chart.liveTailing()).toBe(false);
      expect(chart['atLatest']()).toBe(false);
      const start = chart['viewStart']();
      fixture.componentRef.setInput('points', [
        ...points,
        { time: new Date(2026, 0, 1, 12), value: 240 },
      ]);
      fixture.detectChanges();
      expect(chart['viewStart']()).toBe(start);
    },
  );

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

  it('keeps Latest beside the indicator labels and works without indicators', () => {
    const fixture = setupIndicatorCandles(120, true);
    const component = fixture.componentInstance;
    component['pan'](-0.5);
    fixture.detectChanges();
    const row = fixture.nativeElement.querySelector('.chart-top-right');
    expect(row.parentElement.classList.contains('chart-toolbar')).toBe(true);
    expect(row.parentElement.querySelector('.chart-control-bar')).not.toBeNull();
    expect(row.querySelector('.chart-indicator-key')).not.toBeNull();
    expect(row.querySelector('button').textContent).toContain('Latest');
    fixture.componentRef.setInput('enabledIndicators', []);
    fixture.detectChanges();
    expect(row.querySelector('.chart-indicator-key')).toBeNull();
    row.querySelector('button').click();
    fixture.detectChanges();
    expect(component['atLatest']()).toBe(true);
    expect(row.querySelector('button')).toBeNull();
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

  describe('interaction', () => {
    const longSeries = () =>
      Array.from({ length: 120 }, (_, index) => ({
        time: new Date(2026, 0, 1, 9, index),
        value: 100 + index,
      }));

    function plotStub(width = 200) {
      const captured = new Set<number>();
      return {
        getBoundingClientRect: () => ({ left: 0, width }) as DOMRect,
        setPointerCapture: (id: number) => captured.add(id),
        hasPointerCapture: (id: number) => captured.has(id),
        releasePointerCapture: (id: number) => captured.delete(id),
        captured,
      };
    }

    const pointer = (clientX: number, pointerId = 1) => ({ clientX, pointerId }) as PointerEvent;

    it('shows a hover point under the pointer and clears it when the pointer leaves', () => {
      const fixture = setup('1D', longSeries(), true);
      const component = fixture.componentInstance;
      const plot = plotStub();
      component['onPointerMove'](pointer(100), plot as unknown as HTMLElement);
      expect(component['hoverIndex']()).not.toBeNull();
      component['onPointerLeave']();
      expect(component['hoverIndex']()).toBeNull();
    });

    it('does nothing on pointer move when there is nothing to show', () => {
      const fixture = setup('1D', [], true);
      fixture.componentInstance['onPointerMove'](pointer(10), plotStub() as unknown as HTMLElement);
      expect(fixture.componentInstance['hoverIndex']()).toBeNull();
    });

    it('drags the view with the pointer and releases the capture', () => {
      const fixture = setup('1D', longSeries(), true);
      const component = fixture.componentInstance;
      const plot = plotStub() as unknown as HTMLElement;
      component['onPointerDown'](pointer(100), plot);
      expect(component['dragStart']).not.toBeNull();
      const before = component['viewStart']();
      component['onPointerMove'](pointer(150), plot);
      expect(component['viewStart']()).toBeLessThan(before);
      component['onPointerLeave']();
      component['onPointerUp'](pointer(150), plot);
      expect(component['dragStart']).toBeNull();
    });

    it('only inspects on pointer down when the chart is not interactive', () => {
      const fixture = setup('1D', longSeries(), false);
      const component = fixture.componentInstance;
      component['onPointerDown'](pointer(100), plotStub() as unknown as HTMLElement);
      expect(component['dragStart']).toBeNull();
      expect(component['hoverIndex']()).not.toBeNull();
    });

    it('ignores a pointer-up that never held the capture', () => {
      const fixture = setup('1D', longSeries(), true);
      expect(() =>
        fixture.componentInstance['onPointerUp'](pointer(1), {} as unknown as HTMLElement),
      ).not.toThrow();
    });

    it('zooms with the wheel, pans with horizontal wheel and ignores it when not interactive', () => {
      const fixture = setup('1D', longSeries(), true);
      const component = fixture.componentInstance;
      const plot = plotStub() as unknown as HTMLElement;
      const wheel = (init: Partial<WheelEvent>) => {
        const event = {
          preventDefault: vi.fn(),
          clientX: 100,
          deltaX: 0,
          deltaY: 0,
          ctrlKey: false,
          ...init,
        };
        component['onWheel'](event as unknown as WheelEvent, plot);
        return event;
      };
      const initial = component['visiblePoints']().length;
      wheel({ deltaY: -200 });
      expect(component['visiblePoints']().length).toBeLessThan(initial);
      wheel({ deltaY: 100, ctrlKey: true });
      component['pan'](-0.5);
      const start = component['viewStart']();
      const horizontal = wheel({ deltaX: 40 });
      expect(horizontal.preventDefault).toHaveBeenCalled();
      expect(component['viewStart']()).toBeGreaterThanOrEqual(start);

      fixture.componentRef.setInput('interactive', false);
      const ignored = wheel({ deltaY: 100 });
      expect(ignored.preventDefault).not.toHaveBeenCalled();
    });

    it('zooms, resets and moves with the keyboard', () => {
      const fixture = setup('1D', longSeries(), true);
      const component = fixture.componentInstance;
      const key = (value: string) => {
        const event = new KeyboardEvent('keydown', { key: value, cancelable: true });
        component['onKeydown'](event);
        return event;
      };
      const initial = component['visiblePoints']().length;
      expect(key('+').defaultPrevented).toBe(true);
      const zoomedIn = component['visiblePoints']().length;
      expect(zoomedIn).toBeLessThan(initial);
      key('=');
      key('-');
      expect(component['visiblePoints']().length).toBeGreaterThan(zoomedIn - 20);
      key('0');
      expect(component['visiblePoints']().length).toBe(initial);
      key('ArrowRight');
      key('End');
      expect(component['hoverIndex']()).toBe(component['visiblePoints']().length - 1);
      const escape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
      const stop = vi.spyOn(escape, 'stopPropagation');
      component['onKeydown'](escape);
      expect(stop).toHaveBeenCalled();
      expect(component['hoverIndex']()).toBeNull();
      const second = new KeyboardEvent('keydown', { key: 'Escape' });
      const stopAgain = vi.spyOn(second, 'stopPropagation');
      component['onKeydown'](second);
      expect(stopAgain).not.toHaveBeenCalled();
      expect(key('x').defaultPrevented).toBe(false);
    });

    it('does not zoom from the keyboard when the chart is not interactive', () => {
      const fixture = setup('1D', longSeries(), false);
      const component = fixture.componentInstance;
      component['onKeydown'](new KeyboardEvent('keydown', { key: '+' }));
      expect(component['visiblePoints']()).toHaveLength(120);
    });

    it('ignores the keyboard when there is nothing to move through', () => {
      const fixture = setup('1D', [], true);
      fixture.componentInstance['onKeydown'](new KeyboardEvent('keydown', { key: 'End' }));
      expect(fixture.componentInstance['hoverIndex']()).toBeNull();
    });

    it('wires the toolbar buttons and plot events to the view', () => {
      const fixture = setup('1D', longSeries(), true);
      const component = fixture.componentInstance;
      const root: HTMLElement = fixture.nativeElement;
      const click = (label: string) => {
        (root.querySelector(`[aria-label="${label}"]`) as HTMLElement).click();
        fixture.detectChanges();
      };
      const initial = component['visiblePoints']().length;
      click('Zoom in');
      const zoomedIn = component['visiblePoints']().length;
      expect(zoomedIn).toBeLessThan(initial);
      click('Zoom out');
      expect(component['visiblePoints']().length).toBeGreaterThan(zoomedIn);
      click('Zoom in');
      click('Pan left');
      click('Pan right');
      click('Reset chart view');
      expect(component['visiblePoints']().length).toBe(initial);

      const plot = root.querySelector('[tabindex="0"]') as HTMLElement;
      plot.getBoundingClientRect = () => ({ left: 0, width: 200 }) as DOMRect;
      for (const type of [
        'pointerdown',
        'pointermove',
        'pointerup',
        'pointercancel',
        'pointerleave',
      ]) {
        plot.dispatchEvent(new MouseEvent(type, { clientX: 80, bubbles: true }));
      }
      plot.dispatchEvent(new WheelEvent('wheel', { deltaY: -50, clientX: 50, cancelable: true }));
      plot.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
      expect(component['hoverIndex']()).toBe(0);
    });
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
