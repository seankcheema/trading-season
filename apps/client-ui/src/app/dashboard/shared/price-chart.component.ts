import { ChartTimeDomain, timePosition, monotonePath, spaceTransitions } from './portfolio-axis';
import {
  DecimalPipe,
  UpperCasePipe,
  formatCurrency,
  formatDate,
  formatNumber,
} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  LOCALE_ID,
  afterNextRender,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { PricePoint, Timeframe } from '../mock-data';
import {
  ChartMode,
  MarketCandlePoint,
  TECHNICAL_INDICATOR_PERIODS,
  TechnicalIndicator,
  bollingerBands,
  closePricePoints,
  exponentialMovingAverage,
  percentChangePoints,
  relativeStrengthIndex,
  simpleMovingAverage,
} from './market-chart.models';
import { SignedPercentPipe } from './signed-percent.pipe';

const WIDTH = 100;
const HEIGHT = 40;
const PADDING = 2;
const MAX_TICKS = 6;
const VALUE_TICKS = 5;
// Blank space kept between neighbouring time labels, and the width one character of the
// axis font takes. Measuring every label would cost a layout pass per render, so the width
// is estimated; the estimate runs slightly wide so a near miss drops a label rather than
// letting two collide.
const LABEL_GAP = 10;
const LABEL_CHAR_WIDTH = 6.6;
const MIN_VISIBLE_POINTS = 12;
const DEFAULT_VISIBLE_POINTS = 78;

let nextId = 0;

const AXIS_FORMATS: Record<Timeframe, string> = {
  '1D': 'h:mm a',
  '5D': 'EEE d',
  '1M': 'MMM d',
  '1Y': "MMM ''yy",
};

// Multiples of each timeframe's base slot that the axis may label, narrowest first. The
// 1D axis is slotted in quarter hours, so it can run every 15m, 30m, 1h … 4h; the others
// are slotted in whole days, and 1Y in whole months.
const AXIS_STEPS: Record<Timeframe, number[]> = {
  '1D': [1, 2, 4, 8, 12, 16],
  '5D': [1, 2, 3],
  '1M': [1, 2, 5, 7, 14],
  '1Y': [1, 2, 3, 4, 6],
};

const TOOLTIP_FORMATS: Record<Timeframe, string> = {
  '1D': 'h:mm a',
  '5D': 'EEE, MMM d, h:mm a',
  '1M': 'EEE, MMM d, y',
  '1Y': 'MMM d, y',
};

interface AxisTick {
  index: number;
  x: number;
  svgX: number;
  label: string;
  transform: string;
}

interface ValueTick {
  value: number;
  y: number;
  svgY: number;
  label: string;
}

interface ChartScale {
  min: number;
  max: number;
  range: number;
}

interface MarkerPoint {
  x: number;
  y: number;
}

interface CurrentPriceMarker {
  y: number;
  svgY: number;
  label: string;
}

interface VolumeBar {
  x: number;
  width: number;
  height: number;
  up: boolean;
}

interface CandleBar {
  x: number;
  width: number;
  highY: number;
  lowY: number;
  openY: number;
  closeY: number;
  bodyY: number;
  bodyHeight: number;
  up: boolean;
}

interface TooltipPosition {
  left: number;
  top: number;
  flipLeft: boolean;
  flipTop: boolean;
}

@Component({
  selector: 'app-price-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, SignedPercentPipe, UpperCasePipe],
  host: { class: 'flex flex-col' },
  template: `
    <div
      class="relative grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_4.75rem] grid-rows-[1.25rem_minmax(0,1fr)_1rem] gap-x-3 gap-y-2"
    >
      @if (interactive()) {
        <div
          class="chart-control-bar absolute top-0 left-0 z-30 flex items-center gap-0.5 rounded-lg border p-0.5 backdrop-blur-sm"
          (pointerdown)="$event.stopPropagation()"
        >
          <button
            type="button"
            class="chart-control"
            aria-label="Zoom out"
            [disabled]="!canZoomOut()"
            (click)="zoom(1.25)"
          >
            −
          </button>
          <button
            type="button"
            class="chart-control"
            aria-label="Zoom in"
            [disabled]="!canZoomIn()"
            (click)="zoom(0.8)"
          >
            +
          </button>
          <span class="bg-border mx-0.5 h-3.5 w-px"></span>
          <button
            type="button"
            class="chart-control"
            aria-label="Pan left"
            [disabled]="viewStart() === 0"
            (click)="pan(-0.25)"
          >
            ‹
          </button>
          <button
            type="button"
            class="chart-control"
            aria-label="Pan right"
            [disabled]="atLatest()"
            (click)="pan(0.25)"
          >
            ›
          </button>
          <button
            type="button"
            class="chart-control px-1.5"
            aria-label="Reset chart view"
            (click)="resetView()"
          >
            Reset
          </button>
          <span class="px-1 text-[10px] font-semibold tabular-nums text-[#eefaff]/70"
            >{{ visiblePoints().length }} bars</span
          >
        </div>
      }
      @if (priceIndicatorsEnabled().length) {
        <div class="chart-indicator-key" aria-label="Price chart indicators">
          @for (indicator of priceIndicatorsEnabled(); track indicator) {
            <span [attr.data-indicator]="indicator">
              {{
                indicator === 'bollinger' ? 'Bollinger 20 · 2σ' : (indicator | uppercase) + ' 20'
              }}
            </span>
          }
          @if (!hasEnoughPriceIndicatorData()) {
            <small>Needs 20 candles</small>
          }
        </div>
      }
      <div class="relative min-w-0" aria-hidden="true"></div>
      <div aria-hidden="true"></div>

      <div
        #plot
        tabindex="0"
        role="group"
        class="focus-visible:ring-ring/50 relative min-h-0 rounded-[2px] outline-none focus-visible:ring-2"
        [class.touch-none]="interactive()"
        [class.touch-pan-y]="!interactive()"
        [attr.aria-label]="ariaLabel()"
        (wheel)="onWheel($event, plot)"
        (pointermove)="onPointerMove($event, plot)"
        (pointerdown)="onPointerDown($event, plot)"
        (pointerup)="onPointerUp($event, plot)"
        (pointercancel)="onPointerUp($event, plot)"
        (pointerleave)="onPointerLeave()"
        (dblclick)="resetView()"
        (keydown)="onKeydown($event)"
        (blur)="hoverIndex.set(null)"
      >
        @if (hovered(); as point) {
          <div
            class="bg-foreground/40 pointer-events-none absolute inset-y-0 w-px"
            [style.left.%]="point.x"
          ></div>
        }

        @if (tooltipPoint(); as point) {
          @if (tooltipPosition(); as pos) {
            <div
              class="price-hover-label pointer-events-none absolute whitespace-nowrap tabular-nums overflow-hidden rounded px-2 py-1"
              [class]="hovered() ? '' : 'invisible'"
              [style.left.%]="pos.left"
              [style.top.%]="pos.top"
              [class.translate-x-0]="!pos.flipLeft"
              [class.-translate-x-full]="pos.flipLeft"
              [class.translate-y-0]="!pos.flipTop"
              [class.-translate-y-full]="pos.flipTop"
            >
              <span class="text-[13px]/5 font-semibold">{{ point.valueLabel }}</span>
              <span
                class="text-[13px]/5"
                [class]="point.changePercent >= 0 ? 'text-gain' : 'text-loss'"
              >
                {{ point.changePercent | signedPercent }}
              </span>
              <span class="text-muted-foreground text-[13px]/5">· {{ point.timeLabel }}</span>
              @if (point.volumeLabel) {
                <span class="text-primary text-[13px]/5">· Vol {{ point.volumeLabel }}</span>
              }
              @if (point.ohlcLabel) {
                <span class="text-muted-foreground text-[13px]/5">· {{ point.ohlcLabel }}</span>
              }
            </div>
          }
        }

        @if (interactive() && !atLatest()) {
          <button
            type="button"
            class="border-primary/40 bg-primary/15 text-primary absolute right-2 bottom-2 z-20 h-7 rounded-full border px-3 text-xs font-medium"
            (pointerdown)="$event.stopPropagation()"
            (click)="goLatest()"
          >
            Latest ››
          </button>
        }

        <svg
          [attr.data-chart-mode]="mode()"
          [attr.viewBox]="viewBox"
          preserveAspectRatio="none"
          class="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          aria-hidden="true"
        >
          @if (showsArea()) {
            <defs>
              <linearGradient [attr.id]="gradientId" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" [style.stop-color]="trendColor()" stop-opacity="0.28" />
                <stop offset="1" [style.stop-color]="trendColor()" stop-opacity="0" />
              </linearGradient>
            </defs>
          }

          @for (tick of yTicks(); track tick.value) {
            <line
              x1="0"
              [attr.y1]="tick.svgY"
              [attr.x2]="WIDTH"
              [attr.y2]="tick.svgY"
              class="stroke-border/60"
              stroke-width="0.5"
              vector-effect="non-scaling-stroke"
            />
          }
          @for (tick of ticks(); track tick.index) {
            <line
              [attr.x1]="tick.svgX"
              y1="0"
              [attr.x2]="tick.svgX"
              [attr.y2]="HEIGHT"
              class="stroke-border/35"
              stroke-width="0.5"
              vector-effect="non-scaling-stroke"
            />
          }
          @if (currentPriceMarker(); as marker) {
            <line
              x1="0"
              [attr.y1]="marker.svgY"
              [attr.x2]="WIDTH"
              [attr.y2]="marker.svgY"
              [style.stroke]="trendColor()"
              stroke-width="1"
              stroke-dasharray="3 3"
              vector-effect="non-scaling-stroke"
              opacity="0.8"
            />
          }
          <line
            x1="0"
            [attr.y1]="HEIGHT"
            [attr.x2]="WIDTH"
            [attr.y2]="HEIGHT"
            class="stroke-border"
            stroke-width="0.5"
            vector-effect="non-scaling-stroke"
          />
          @if (showsArea() && areaPath()) {
            <path [attr.d]="areaPath()" [attr.fill]="'url(#' + gradientId + ')'" />
          }
          @if (showsCandles()) {
            @for (bar of candleBars(); track $index) {
              <g class="chart-candle" [class.chart-candle-up]="bar.up">
                <line
                  [attr.x1]="bar.x"
                  [attr.y1]="bar.highY"
                  [attr.x2]="bar.x"
                  [attr.y2]="bar.lowY"
                  vector-effect="non-scaling-stroke"
                />
                @if (mode() === 'candles') {
                  <rect
                    [attr.x]="bar.x - bar.width / 2"
                    [attr.y]="bar.bodyY"
                    [attr.width]="bar.width"
                    [attr.height]="bar.bodyHeight"
                    vector-effect="non-scaling-stroke"
                  />
                } @else {
                  <line
                    class="ohlc-open-tick"
                    [attr.x1]="bar.x - bar.width / 2"
                    [attr.y1]="bar.openY"
                    [attr.x2]="bar.x"
                    [attr.y2]="bar.openY"
                    vector-effect="non-scaling-stroke"
                  />
                  <line
                    class="ohlc-close-tick"
                    [attr.x1]="bar.x"
                    [attr.y1]="bar.closeY"
                    [attr.x2]="bar.x + bar.width / 2"
                    [attr.y2]="bar.closeY"
                    vector-effect="non-scaling-stroke"
                  />
                }
              </g>
            }
          }
          @for (bar of volumeBars(); track $index) {
            <rect
              class="chart-volume-bar"
              [attr.x]="bar.x"
              [attr.y]="HEIGHT - bar.height"
              [attr.width]="bar.width"
              [attr.height]="bar.height"
              [class]="bar.up ? 'fill-gain/45' : 'fill-loss/45'"
            />
          }
          @if (showsLine()) {
            <path
              class="chart-price-line"
              [attr.d]="linePath()"
              fill="none"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              vector-effect="non-scaling-stroke"
              [class]="trendingUp() ? 'stroke-gain' : 'stroke-loss'"
            />
          }
          @if (showsPriceIndicators()) {
            @if (bollingerAreaPath()) {
              <path class="chart-bollinger-area" [attr.d]="bollingerAreaPath()" />
              <path
                class="chart-indicator-line chart-indicator-bollinger"
                [attr.d]="bollingerUpperPath()"
                fill="none"
                vector-effect="non-scaling-stroke"
              />
              <path
                class="chart-indicator-line chart-indicator-bollinger"
                [attr.d]="bollingerLowerPath()"
                fill="none"
                vector-effect="non-scaling-stroke"
              />
            }
            @if (smaPath()) {
              <path
                class="chart-indicator-line chart-indicator-sma"
                [attr.d]="smaPath()"
                fill="none"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                vector-effect="non-scaling-stroke"
              />
            }
            @if (emaPath()) {
              <path
                class="chart-indicator-line chart-indicator-ema"
                [attr.d]="emaPath()"
                fill="none"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                vector-effect="non-scaling-stroke"
              />
            }
          }
        </svg>

        @if (persistentPoint(); as point) {
          <div
            class="price-current-marker ring-card pointer-events-none absolute z-10 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-sm ring-2"
            [class]="trendingUp() ? 'bg-gain' : 'bg-loss'"
            [style.left.%]="point.x"
            [style.top.%]="point.y"
          ></div>
        }

        @for (point of isolatedObservations(); track point.x) {
          <div
            class="price-observation-marker pointer-events-none absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            [class]="trendingUp() ? 'bg-gain' : 'bg-loss'"
            [style.left.%]="point.x"
            [style.top.%]="point.y"
          ></div>
        }

        @if (hovered(); as point) {
          <div
            class="ring-card pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2"
            [class]="trendingUp() ? 'bg-gain' : 'bg-loss'"
            [style.left.%]="point.x"
            [style.top.%]="point.y"
          ></div>
        }
      </div>

      <div
        class="text-muted-foreground relative min-h-0 border-l border-border/70 text-right text-[11px] tabular-nums"
        aria-hidden="true"
      >
        @for (tick of yTicks(); track tick.value) {
          <span class="absolute right-0 -translate-y-1/2 whitespace-nowrap" [style.top.%]="tick.y">
            {{ tick.label }}
          </span>
        }
        @if (currentPriceMarker(); as marker) {
          <span
            class="current-price-axis-label absolute right-0 z-10 -translate-y-1/2 whitespace-nowrap"
            [class.current-price-gain]="trendingUp()"
            [class.current-price-loss]="!trendingUp()"
            [style.top.%]="marker.y"
          >
            {{ marker.label }}
          </span>
        }
      </div>

      <div class="text-muted-foreground relative h-4 text-xs" aria-hidden="true">
        @for (tick of ticks(); track tick.index) {
          <span
            class="absolute top-0 whitespace-nowrap"
            [style.left.%]="tick.x"
            [style.transform]="tick.transform"
          >
            {{ tick.label }}
          </span>
        }
      </div>
      <div aria-hidden="true"></div>
    </div>
    @if (rsiEnabled()) {
      <section class="rsi-pane" aria-label="Relative Strength Index 14">
        <div class="rsi-header">
          <span>RSI 14</span>
          @if (rsiIsMock()) {
            <em>Demo</em>
          }
          @if (latestRsi(); as value) {
            <strong>{{ value | number: '1.1-1' }}</strong>
          }
        </div>
        <div class="rsi-grid">
          <div class="rsi-plot">
            @if (rsiPath()) {
              <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
                <line x1="0" y1="12" x2="100" y2="12" class="rsi-guide" />
                <line x1="0" y1="28" x2="100" y2="28" class="rsi-guide" />
                <path class="rsi-line" [attr.d]="rsiPath()" fill="none" />
              </svg>
            }
          </div>
          <div class="rsi-axis" aria-hidden="true">
            <span class="rsi-axis-70">70</span>
            <span class="rsi-axis-30">30</span>
          </div>
        </div>
      </section>
    }
  `,
  styles: `
    .chart-control-bar {
      border-color: rgba(238, 250, 255, 0.28);
      background: #242424;
    }
    .chart-control {
      min-width: 1.5rem;
      height: 1.5rem;
      border-radius: 0.375rem;
      color: rgba(238, 250, 255, 0.9);
      font-size: 0.8125rem;
      font-weight: 600;
      line-height: 1;
      cursor: pointer;
    }
    .chart-control:hover:not(:disabled) {
      background: rgba(238, 250, 255, 0.1);
    }
    .chart-control:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .chart-indicator-key {
      position: absolute;
      top: 0;
      right: 4.75rem;
      z-index: 20;
      display: flex;
      max-width: calc(100% - 15rem);
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0.25rem;
      color: var(--muted-foreground);
      font-size: 0.5625rem;
    }
    .chart-indicator-key span,
    .chart-indicator-key small {
      border-radius: 999px;
      background: color-mix(in srgb, var(--card) 90%, transparent);
      padding: 0.15rem 0.4rem;
      font-weight: 600;
    }
    .chart-indicator-key span[data-indicator='sma'] {
      color: #f6c453;
    }
    .chart-indicator-key span[data-indicator='ema'] {
      color: #b784ff;
    }
    .chart-indicator-key span[data-indicator='bollinger'] {
      color: #ff8f66;
    }
    .price-hover-label {
      max-width: 12rem;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 0.375rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      z-index: 15;
    }
    .price-hover-label > span {
      display: block;
    }
    .current-price-axis-label {
      min-width: 4.5rem;
      border-radius: 0.2rem;
      padding: 0.15rem 0.25rem;
      color: white;
      font-size: 0.6875rem;
      font-weight: 700;
      line-height: 1.1;
      text-align: right;
      box-shadow: 0 0 0 1px var(--card);
    }
    .current-price-gain {
      background: #08783e;
    }
    .current-price-loss {
      background: #b4232e;
    }
    .chart-candle {
      stroke: var(--color-loss);
      fill: var(--color-loss);
      stroke-width: 1.25;
    }
    .chart-candle-up {
      stroke: var(--color-gain);
      fill: var(--color-gain);
    }
    .chart-candle rect {
      min-height: 1px;
    }
    .chart-indicator-line {
      pointer-events: none;
    }
    .chart-indicator-sma {
      stroke: #f6c453;
    }
    .chart-indicator-ema {
      stroke: #b784ff;
    }
    .chart-indicator-bollinger {
      stroke: #ff8f66;
      stroke-width: 1;
      stroke-dasharray: 4 3;
    }
    .chart-bollinger-area {
      fill: rgba(255, 143, 102, 0.08);
      pointer-events: none;
    }
    .rsi-pane {
      flex: 0 0 8rem;
      min-height: 0;
      border-top: 1px solid var(--border);
      padding-top: 0.45rem;
    }
    .rsi-header {
      display: flex;
      height: 1rem;
      align-items: center;
      gap: 0.45rem;
      color: var(--muted-foreground);
      font-size: 0.625rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .rsi-header strong {
      color: #42d3ff;
      font-size: 0.6875rem;
    }
    .rsi-header em {
      border-radius: 999px;
      background: rgba(66, 211, 255, 0.12);
      padding: 0.1rem 0.35rem;
      color: #42d3ff;
      font-size: 0.5rem;
      font-style: normal;
    }
    .rsi-grid {
      display: grid;
      height: calc(100% - 1rem);
      min-height: 0;
      grid-template-columns: minmax(0, 1fr) 4.75rem;
      gap: 0.75rem;
    }
    .rsi-plot {
      position: relative;
      min-width: 0;
      min-height: 0;
      background: rgba(238, 250, 255, 0.015);
    }
    .rsi-plot svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .rsi-guide {
      stroke: rgba(238, 250, 255, 0.2);
      stroke-width: 0.5;
      stroke-dasharray: 3 3;
      vector-effect: non-scaling-stroke;
    }
    .rsi-line {
      stroke: #42d3ff;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
      vector-effect: non-scaling-stroke;
    }
    .rsi-axis {
      position: relative;
      border-left: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
      color: var(--muted-foreground);
      font-size: 0.625rem;
      font-variant-numeric: tabular-nums;
      text-align: right;
    }
    .rsi-axis span {
      position: absolute;
      right: 0;
      transform: translateY(-50%);
    }
    .rsi-axis-70 {
      top: 30%;
    }
    .rsi-axis-30 {
      top: 70%;
    }
    @media (max-width: 640px) {
      .chart-indicator-key {
        top: 1.8rem;
        right: 2rem;
        max-width: calc(100% - 2rem);
      }
      .rsi-pane {
        flex-basis: 6rem;
      }
      .rsi-grid {
        grid-template-columns: minmax(0, 1fr) 2rem;
        gap: 0.35rem;
      }
      .rsi-axis {
        font-size: 0.5625rem;
      }
    }
  `,
})
export class PriceChartComponent {
  readonly points = input<PricePoint[]>([]);
  readonly candles = input<MarketCandlePoint[]>([]);
  readonly mode = input<ChartMode>('line');
  readonly timeframe = input.required<Timeframe>();
  readonly timezone = input('UTC');
  readonly interactive = input(false, { transform: booleanAttribute });
  readonly interactionKey = input('');
  readonly showCurrentPrice = input(false, { transform: booleanAttribute });
  readonly enabledIndicators = input<readonly TechnicalIndicator[]>([]);
  // Fills the space under the line with a gradient in the trend color.
  readonly area = input(false, { transform: booleanAttribute });
  // Recorded observations use elapsed time and leave missing intervals disconnected.
  readonly observationIntervalMs = input(0);
  readonly minimumTransitionSpacingPx = input(0);
  readonly changeBaseline = input<'first' | 'first-positive'>('first');
  readonly timeDomain = input<ChartTimeDomain | null>(null);
  readonly curveMode = input<'default' | 'monotone'>('default');

  private readonly activePoints = computed(() => {
    const candles = this.candles();
    if (this.mode() === 'percent' && candles.length) {
      return percentChangePoints(candles);
    }
    if (this.points().length) {
      return this.points();
    }
    return closePricePoints(candles);
  });

  private readonly _locale = inject(LOCALE_ID);
  protected readonly gradientId = `price-chart-area-${nextId++}`;

  protected readonly WIDTH = WIDTH;
  protected readonly HEIGHT = HEIGHT;
  protected readonly viewBox = `0 0 ${WIDTH} ${HEIGHT}`;
  protected readonly hoverIndex = signal<number | null>(null);
  protected readonly viewStart = signal(0);
  protected readonly viewCount = signal(DEFAULT_VISIBLE_POINTS);
  private dragStart: { x: number; start: number } | null = null;

  protected readonly visiblePoints = computed(() => {
    const points = this.activePoints();
    if (!this.interactive()) {
      return points;
    }
    const count = Math.min(points.length, this.viewCount());
    const start = Math.min(this.viewStart(), Math.max(0, points.length - count));
    return points.slice(start, start + count);
  });
  protected readonly visibleCandles = computed(() => {
    const candles = this.candles();
    if (!this.interactive()) {
      return candles;
    }
    return candles.slice(this.viewStart(), this.viewStart() + this.visiblePoints().length);
  });
  protected readonly atLatest = computed(
    () => this.viewStart() + this.visiblePoints().length >= this.activePoints().length,
  );
  protected readonly canZoomIn = computed(
    () => this.visiblePoints().length > Math.min(MIN_VISIBLE_POINTS, this.activePoints().length),
  );
  protected readonly canZoomOut = computed(
    () => this.visiblePoints().length < this.activePoints().length,
  );
  private readonly seriesKey = computed(
    () =>
      `${this.interactive()}:${this.interactionKey()}:${this.timeframe()}:${this.mode()}:${this.activePoints().length ? 'ready' : 'empty'}`,
  );

  private readonly _plot = viewChild.required<ElementRef<HTMLElement>>('plot');
  private readonly _plotWidth = signal(0);

  constructor() {
    const destroyRef = inject(DestroyRef);

    effect(() => {
      this.seriesKey();
      untracked(() => this.resetView());
    });

    afterNextRender(() => {
      // Absent in the unit-test DOM; the axis then falls back to its unmeasured spacing.
      if (typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver(([entry]) =>
        this._plotWidth.set(entry.contentRect.width),
      );
      observer.observe(this._plot().nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  protected readonly trendingUp = computed(() => {
    const values = this.visiblePoints();
    return values.length < 2 || values[values.length - 1].value >= values[0].value;
  });

  protected readonly showsLine = computed(() => ['line', 'area', 'percent'].includes(this.mode()));
  protected readonly showsArea = computed(
    () => this.mode() === 'area' || (this.mode() === 'line' && this.area()),
  );
  protected readonly showsCandles = computed(() => ['candles', 'ohlc'].includes(this.mode()));
  protected readonly showsPriceIndicators = computed(
    () => this.mode() !== 'volume' && this.mode() !== 'percent',
  );
  protected readonly rsiEnabled = computed(() => this.enabledIndicators().includes('rsi'));
  protected readonly priceIndicatorsEnabled = computed(() =>
    this.enabledIndicators().filter(
      (indicator): indicator is Exclude<TechnicalIndicator, 'rsi'> => indicator !== 'rsi',
    ),
  );
  protected readonly hasEnoughPriceIndicatorData = computed(
    () => this.candles().length >= TECHNICAL_INDICATOR_PERIODS.sma,
  );
  private readonly smaSeries = computed(() =>
    this.enabledIndicators().includes('sma')
      ? simpleMovingAverage(this.candles(), TECHNICAL_INDICATOR_PERIODS.sma)
      : [],
  );
  private readonly emaSeries = computed(() =>
    this.enabledIndicators().includes('ema')
      ? exponentialMovingAverage(this.candles(), TECHNICAL_INDICATOR_PERIODS.ema)
      : [],
  );
  private readonly bollingerSeries = computed(() =>
    this.enabledIndicators().includes('bollinger')
      ? bollingerBands(this.candles(), TECHNICAL_INDICATOR_PERIODS.bollinger)
      : [],
  );
  private readonly bollingerUpperSeries = computed(() =>
    this.bollingerSeries().map(({ time, upper: value }) => ({ time, value })),
  );
  private readonly bollingerLowerSeries = computed(() =>
    this.bollingerSeries().map(({ time, lower: value }) => ({ time, value })),
  );
  private readonly rsiSeries = computed(() =>
    this.rsiEnabled() ? relativeStrengthIndex(this.candles(), TECHNICAL_INDICATOR_PERIODS.rsi) : [],
  );
  protected readonly rsiIsMock = computed(() => this.rsiEnabled() && this.rsiSeries().length < 2);
  private readonly mockRsiValues = [48, 51, 49, 54, 58, 55, 60, 57, 53, 56, 59, 62, 58, 55, 57];

  private readonly yScale = computed<ChartScale>(() => {
    const values = this.showsCandles()
      ? this.visibleCandles().flatMap((candle) => [candle.low, candle.high])
      : this.mode() === 'volume'
        ? this.visiblePoints().map((point) => point.volume ?? 0)
        : this.visiblePoints().map((point) => point.value);
    if (this.showsPriceIndicators()) {
      values.push(
        ...this.visibleIndicatorValues(this.smaSeries()),
        ...this.visibleIndicatorValues(this.emaSeries()),
        ...this.visibleIndicatorValues(this.bollingerUpperSeries()),
        ...this.visibleIndicatorValues(this.bollingerLowerSeries()),
      );
    }
    if (!values.length) {
      return { min: 0, max: 1, range: 1 };
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || Math.max(Math.abs(max) * 0.02, 1);
    return { min, max: min + range, range };
  });

  // Point positions as percentages of the plot area.
  private readonly _coords = computed(() => {
    const points = this.visiblePoints();
    const scale = this.yScale();
    const last = Math.max(points.length - 1, 1);
    const positions = points.map((_, i) =>
      this.timeDomain() || this.observationIntervalMs() ? this.observationX(i) : (i / last) * 100,
    );
    const spaced = spaceTransitions(
      positions,
      points.map((point) => !!point.transition),
      (Math.max(0, this.minimumTransitionSpacingPx()) / (this._plotWidth() || 600)) * 100,
    );
    return points.map((point, i) => ({
      x: spaced[i],
      y: this.valueToY(this.mode() === 'volume' ? (point.volume ?? 0) : point.value, scale),
    }));
  });

  protected readonly linePath = computed(() => {
    if (this.curveMode() === 'monotone')
      return monotonePath(
        this.svgCoords().map((point, index) => ({
          ...point,
          transition: this.visiblePoints()[index].transition,
        })),
      );
    const interval = this.observationIntervalMs();
    if (!interval) return this.smoothPath(this.svgCoords());
    return this.svgCoords()
      .map((point, index) => {
        return `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)},${point.y.toFixed(2)}`;
      })
      .join(' ');
  });

  protected readonly isolatedObservations = computed(() => {
    const interval = this.observationIntervalMs();
    if (!interval) return [];
    const points = this.visiblePoints();
    return this._coords().filter(
      (_, index) =>
        index < points.length - 1 &&
        (index === 0 ||
          points[index].time.getTime() - points[index - 1].time.getTime() > interval * 2) &&
        points[index + 1].time.getTime() - points[index].time.getTime() > interval * 2,
    );
  });

  private observationX(index: number): number {
    const points = this.visiblePoints();
    const domain = this.timeDomain();
    if (domain) return timePosition(points[index].time.getTime(), domain);
    const start = points[0]?.time.getTime() ?? 0;
    const span = (points.at(-1)?.time.getTime() ?? start) - start;
    return span > 0 ? ((points[index].time.getTime() - start) / span) * 100 : 100;
  }
  protected readonly smaPath = computed(() => this.indicatorPath(this.smaSeries(), this.yScale()));
  protected readonly emaPath = computed(() => this.indicatorPath(this.emaSeries(), this.yScale()));
  protected readonly bollingerUpperPath = computed(() =>
    this.indicatorPath(this.bollingerUpperSeries(), this.yScale()),
  );
  protected readonly bollingerLowerPath = computed(() =>
    this.indicatorPath(this.bollingerLowerSeries(), this.yScale()),
  );
  protected readonly bollingerAreaPath = computed(() => {
    const upper = this.indicatorSvgCoords(this.bollingerUpperSeries(), this.yScale());
    const lower = this.indicatorSvgCoords(this.bollingerLowerSeries(), this.yScale()).reverse();
    if (upper.length < 2 || upper.length !== lower.length) return '';
    return `${[...upper, ...lower]
      .map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(2)},${point.y.toFixed(2)}`)
      .join(' ')} Z`;
  });
  protected readonly rsiPath = computed(() => {
    const actual = this.indicatorPath(this.rsiSeries(), { min: 0, max: 100, range: 100 });
    if (actual) return actual;
    const last = this.mockRsiValues.length - 1;
    return this.smoothPath(
      this.mockRsiValues.map((value, index) => ({
        x: (index / last) * WIDTH,
        y: (this.valueToY(value, { min: 0, max: 100, range: 100 }) / 100) * HEIGHT,
      })),
    );
  });
  protected readonly latestRsi = computed(
    () => this.visibleIndicatorValues(this.rsiSeries()).at(-1) ?? this.mockRsiValues.at(-1),
  );

  // The line's path closed along the bottom edge of the chart.
  protected readonly areaPath = computed(() => {
    const line = this.linePath();
    const coords = this.svgCoords();
    return line
      ? `${line} L ${coords.at(-1)?.x ?? WIDTH},${HEIGHT} L ${coords[0]?.x ?? 0},${HEIGHT} Z`
      : '';
  });

  protected readonly trendColor = computed(() =>
    this.trendingUp() ? 'var(--color-gain)' : 'var(--color-loss)',
  );

  protected readonly candleBars = computed<CandleBar[]>(() => {
    const candles = this.visibleCandles();
    const scale = this.yScale();
    const slot = WIDTH / Math.max(candles.length, 1);
    const width = Math.max(0.18, Math.min(slot * 0.58, 1.8));
    return candles.map((candle, index) => {
      const openY = (this.valueToY(candle.open, scale) / 100) * HEIGHT;
      const closeY = (this.valueToY(candle.close, scale) / 100) * HEIGHT;
      return {
        x: index * slot + slot / 2,
        width,
        highY: (this.valueToY(candle.high, scale) / 100) * HEIGHT,
        lowY: (this.valueToY(candle.low, scale) / 100) * HEIGHT,
        openY,
        closeY,
        bodyY: Math.min(openY, closeY),
        bodyHeight: Math.max(Math.abs(closeY - openY), 0.35),
        up: candle.close >= candle.open,
      };
    });
  });

  protected readonly currentPriceMarker = computed<CurrentPriceMarker | null>(() => {
    if (!this.showCurrentPrice() || this.mode() === 'volume') {
      return null;
    }
    const latest = this.activePoints().at(-1);
    if (!latest) {
      return null;
    }
    const y = this.clampMarkerPosition(this.valueToY(latest.value, this.yScale()));
    return {
      y,
      svgY: (y / 100) * HEIGHT,
      label: this.formatValue(latest.value, '1.2-2'),
    };
  });

  protected readonly volumeBars = computed<VolumeBar[]>(() => {
    const points = this.visiblePoints();
    const volumes = points.map((point) => point.volume ?? 0);
    const minimum = Math.min(...volumes);
    const maximum = Math.max(...volumes, 0);
    if (!maximum) {
      return [];
    }
    const slot = WIDTH / Math.max(points.length, 1);
    const width = Math.max(0.12, Math.min(slot * 0.62, 1.4));
    const range = maximum - minimum;
    return points.map((point, index) => {
      const normalized = range ? ((point.volume ?? 0) - minimum) / range : 0.5;
      return {
        x: index * slot + (slot - width) / 2,
        width,
        // Stretch the observed range so differences remain visible when volumes cluster.
        height:
          this.mode() === 'volume'
            ? HEIGHT * (0.08 + normalized * 0.84)
            : HEIGHT * (0.04 + normalized * 0.2),
        up: index === 0 || point.value >= points[index - 1].value,
      };
    });
  });

  protected readonly hovered = computed(() => {
    const index = this.hoverIndex();
    return index === null ? null : this.describePoint(index);
  });

  protected readonly persistentPoint = computed<MarkerPoint | null>(() => {
    if (this.mode() === 'volume') {
      return null;
    }
    if (this.hovered()) {
      return null;
    }
    const points = this.visiblePoints();
    if (!points.length) {
      return null;
    }
    if (points.length === 1) {
      return { x: 100, y: this.clampMarkerPosition(this.describePoint(0)?.y ?? 50) };
    }
    const point = this.describePoint(points.length - 1);
    return point
      ? {
          x: point.x,
          y: this.clampMarkerPosition(point.y),
        }
      : null;
  });

  // What the label row above the plot renders: the hovered point, or the latest one as an
  // invisible placeholder so the row keeps a stable layout between hovers.
  protected readonly tooltipPoint = computed(
    () => this.hovered() ?? this.describePoint(this.visiblePoints().length - 1),
  );

  // Calculate tooltip position with cursor offset and edge-aware flipping.
  // Tooltip sits near the hovered point with a small offset, flipping direction when near edges.
  protected readonly tooltipPosition = computed<TooltipPosition | null>(() => {
    const point = this.tooltipPoint();
    if (!point) {
      return null;
    }

    // Cursor offset in percentage of plot dimensions
    const OFFSET_X = 1.5;
    const OFFSET_Y = 1.2;

    // Edge thresholds for flipping (in percentage)
    const LEFT_EDGE_THRESHOLD = 20;
    const RIGHT_EDGE_THRESHOLD = 80;
    const TOP_EDGE_THRESHOLD = 25;
    const BOTTOM_EDGE_THRESHOLD = 75;

    // Start with default positioning (top-right of point)
    let left = point.x + OFFSET_X;
    let top = point.y - OFFSET_Y;
    let flipLeft = false;
    let flipTop = false;

    // Flip left if point is near right edge
    if (left > RIGHT_EDGE_THRESHOLD) {
      left = point.x - OFFSET_X;
      flipLeft = true;
    }

    // Flip top if point is near top edge
    if (top < TOP_EDGE_THRESHOLD) {
      top = point.y + OFFSET_Y;
      flipTop = true;
    }

    // Ensure tooltip stays within bounds
    left = Math.max(0, Math.min(100, left));
    top = Math.max(0, Math.min(100, top));

    return { left, top, flipLeft, flipTop };
  });

  // Labels on round boundaries of the timeframe — 8:00, 8:15, 8:30, or whole days and
  // months — widened until they fit the chart's current width.
  protected readonly ticks = computed<AxisTick[]>(() => {
    const points = this.visiblePoints();
    const timeframe = this.timeframe();
    const format = AXIS_FORMATS[timeframe];
    const domain = this.timeDomain();
    if (domain) {
      const width = this._plotWidth() || 600;
      const count = Math.max(2, Math.min(MAX_TICKS, Math.floor(width / 100) + 1));
      if (domain.sessions?.length) {
        const sessions = domain.sessions;
        const visible =
          sessions.length <= count
            ? sessions
            : Array.from(
                { length: count },
                (_, i) => sessions[Math.round((i * (sessions.length - 1)) / (count - 1))],
              );
        return visible.map((session) => {
          const x = timePosition((session.start + session.end) / 2, domain);
          return {
            index: session.start,
            x,
            svgX: x,
            label: this.formatTime(new Date(session.start), format),
            transform: this.edgeTransform(x),
          };
        });
      }
      return Array.from({ length: count }, (_, i) => {
        const x = (i / (count - 1)) * 100;
        const time = domain.start + ((domain.end - domain.start) * x) / 100;
        return {
          index: i,
          x,
          svgX: x,
          label: this.formatTime(new Date(time), format),
          transform: this.edgeTransform(x),
        };
      });
    }
    const last = Math.max(points.length - 1, 1);
    const slots = points.map((point) => this.slot(point.time, timeframe));

    const build = (step: number): AxisTick[] => {
      const ticks: AxisTick[] = [];
      let previous: number | null = null;
      points.forEach((point, index) => {
        const slot = Math.floor(slots[index] / step);
        if (slot === previous) {
          return;
        }
        previous = slot;
        // The first point of each slot carries the label, so labels sit on the boundary
        // itself rather than wherever the thinning happened to land.
        const x =
          this.timeDomain() || this.observationIntervalMs()
            ? this.observationX(index)
            : (index / last) * 100;
        ticks.push({
          index,
          label: this.formatTime(point.time, format),
          x,
          svgX: (x / 100) * WIDTH,
          transform: this.edgeTransform(x),
        });
      });
      return ticks;
    };

    const fits = (ticks: AxisTick[]) => ticks.length <= MAX_TICKS && !this.labelsCollide(ticks);

    const steps = AXIS_STEPS[timeframe];
    for (const step of steps) {
      const ticks = build(step);
      if (fits(ticks)) {
        return ticks;
      }
      // A series rarely starts on a boundary: a session opening at 9:30 leaves an odd
      // label crowding the 10:00 one. Drop it before widening the whole axis, which would
      // cost every other label too.
      const trimmed = ticks.slice(1);
      if (trimmed.length > 1 && fits(trimmed)) {
        return trimmed;
      }
    }
    return build(steps[steps.length - 1]);
  });

  protected readonly yTicks = computed<ValueTick[]>(() => {
    const scale = this.yScale();
    const step = scale.range / (VALUE_TICKS - 1);
    return Array.from({ length: VALUE_TICKS }, (_, i) => {
      const value = scale.max - step * i;
      const y = this.valueToY(value, scale);
      return {
        value,
        y,
        svgY: (y / 100) * HEIGHT,
        label:
          this.mode() === 'volume'
            ? formatNumber(value, this._locale, '1.0-0')
            : this.formatValue(value, '1.0-1'),
      };
    });
  });

  protected readonly ariaLabel = computed(() => {
    const points = this.visiblePoints();
    if (!points.length) {
      return `${this.mode()} chart, no data`;
    }
    const format = TOOLTIP_FORMATS[this.timeframe()];
    const first = points[0];
    const latest = points[points.length - 1];
    return (
      `${this.mode()} chart from ${this.formatTime(first.time, format)} to ${this.formatTime(latest.time, format)}, ` +
      `trending ${this.trendingUp() ? 'up' : 'down'}. Use arrow keys to inspect values.`
    );
  });

  // The boundary a point falls on, counted from a fixed origin so that a step of N always
  // lands on the same round times whatever the series happens to start at.
  private slot(time: Date, timeframe: Timeframe): number {
    const [year, month, day, hour, minute] = this.formatTime(time, 'yyyy-MM-dd-HH-mm')
      .split('-')
      .map(Number);
    if (timeframe === '1D') {
      return Math.floor((hour * 60 + minute) / 15);
    }
    if (timeframe === '1Y') {
      return year * 12 + month - 1;
    }
    return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
  }

  // True when any label would touch, or come within LABEL_GAP of, the one before it.
  // Before the first measurement — on the server, and in tests without layout — the width
  // is 0 and every set is treated as fitting, leaving the axis at its full MAX_TICKS.
  private labelsCollide(ticks: AxisTick[]): boolean {
    const width = this._plotWidth();
    if (!width) {
      return false;
    }
    let previousRight = -Infinity;
    for (const tick of ticks) {
      const labelWidth = tick.label.length * LABEL_CHAR_WIDTH;
      const center = (tick.x / 100) * width;
      // Mirror the shift edgeTransform() applies, so each label is measured where it lands.
      const left =
        tick.x < 12 ? center : tick.x > 88 ? center - labelWidth : center - labelWidth / 2;
      if (left < previousRight + LABEL_GAP) {
        return true;
      }
      previousRight = left + labelWidth;
    }
    return false;
  }

  // Keeps labels near the edges from spilling outside the chart.
  protected edgeTransform(x: number): string {
    if (x < 12) return 'translateX(0)';
    if (x > 88) return 'translateX(-100%)';
    return 'translateX(-50%)';
  }

  protected onPointerMove(event: PointerEvent, plot: HTMLElement): void {
    const count = this.visiblePoints().length;
    if (!count) {
      return;
    }
    const rect = plot.getBoundingClientRect();
    if (this.dragStart) {
      const delta = ((event.clientX - this.dragStart.x) / rect.width) * count;
      this.setView(this.dragStart.start - delta, count);
      return;
    }
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    if (this.timeDomain() || this.observationIntervalMs()) {
      const coords = this._coords();
      if (this.timeDomain() && ratio * 100 > (coords.at(-1)?.x ?? 0) + 0.5) {
        this.hoverIndex.set(null);
        return;
      }
      let nearest = 0;
      for (let index = 1; index < coords.length; index++) {
        if (Math.abs(coords[index].x - ratio * 100) < Math.abs(coords[nearest].x - ratio * 100))
          nearest = index;
      }
      this.hoverIndex.set(nearest);
    } else {
      this.hoverIndex.set(Math.round(ratio * (count - 1)));
    }
  }

  protected onPointerDown(event: PointerEvent, plot: HTMLElement): void {
    if (!this.interactive()) {
      this.onPointerMove(event, plot);
      return;
    }
    plot.setPointerCapture?.(event.pointerId);
    this.dragStart = { x: event.clientX, start: this.viewStart() };
    this.onPointerMove(event, plot);
  }

  protected onPointerUp(event: PointerEvent, plot: HTMLElement): void {
    if (plot.hasPointerCapture?.(event.pointerId)) {
      plot.releasePointerCapture(event.pointerId);
    }
    this.dragStart = null;
  }

  protected onPointerLeave(): void {
    if (!this.dragStart) {
      this.hoverIndex.set(null);
    }
  }

  protected onWheel(event: WheelEvent, plot: HTMLElement): void {
    if (!this.interactive()) {
      return;
    }
    event.preventDefault();
    const rect = plot.getBoundingClientRect();
    const anchor = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      this.setView(
        this.viewStart() + (event.deltaX / rect.width) * this.viewCount(),
        this.viewCount(),
      );
      return;
    }
    const factor = Math.exp(event.deltaY * (event.ctrlKey ? 0.01 : 0.0025));
    this.zoom(factor, anchor);
  }

  protected zoom(factor: number, anchor = 0.5): void {
    const oldCount = this.visiblePoints().length;
    const nextCount = Math.max(
      Math.min(MIN_VISIBLE_POINTS, this.activePoints().length),
      Math.min(this.activePoints().length, Math.round(oldCount * factor)),
    );
    this.setView(this.viewStart() + (oldCount - nextCount) * anchor, nextCount);
  }

  protected pan(amount: number): void {
    this.setView(this.viewStart() + this.viewCount() * amount, this.viewCount());
  }

  protected goLatest(): void {
    this.setView(this.activePoints().length - this.viewCount(), this.viewCount());
  }

  protected resetView(): void {
    const count = Math.min(DEFAULT_VISIBLE_POINTS, this.activePoints().length);
    this.setView(this.activePoints().length - count, count);
  }

  private setView(start: number, count: number): void {
    const safeCount = Math.max(0, Math.min(this.activePoints().length, Math.round(count)));
    const safeStart = Math.max(
      0,
      Math.min(this.activePoints().length - safeCount, Math.round(start)),
    );
    this.viewCount.set(safeCount);
    this.viewStart.set(safeStart);
    this.hoverIndex.set(null);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.interactive() && (event.key === '+' || event.key === '=')) {
      event.preventDefault();
      this.zoom(0.8);
      return;
    }
    if (this.interactive() && event.key === '-') {
      event.preventDefault();
      this.zoom(1.25);
      return;
    }
    if (this.interactive() && event.key === '0') {
      event.preventDefault();
      this.resetView();
      return;
    }
    const last = this.visiblePoints().length - 1;
    if (last < 0) {
      return;
    }
    const current = this.hoverIndex() ?? last;
    const next: Record<string, number> = {
      ArrowLeft: Math.max(0, current - 1),
      ArrowRight: Math.min(last, current + 1),
      Home: 0,
      End: last,
    };
    if (event.key in next) {
      event.preventDefault();
      this.hoverIndex.set(next[event.key]);
    } else if (event.key === 'Escape' && this.hoverIndex() !== null) {
      // Clear the inspection without also closing an enclosing dialog.
      event.stopPropagation();
      this.hoverIndex.set(null);
    }
  }

  private describePoint(index: number) {
    const points = this.visiblePoints();
    const point = points[index];
    if (!point) {
      return null;
    }
    const baselineIndex = this.changeBaseline() === 'first-positive'
      ? points.findIndex((observation) => observation.value > 0)
      : 0;
    const baseline = points[baselineIndex]?.value;
    return {
      ...this._coords()[index],
      valueLabel: this.formatValue(point.value),
      timeLabel: this.formatTime(point.time, TOOLTIP_FORMATS[this.timeframe()]),
      volumeLabel:
        point.volume === undefined ? '' : formatNumber(point.volume, this._locale, '1.0-0'),
      changePercent:
        this.mode() === 'percent'
          ? point.value
          : baseline
            ? ((point.value - baseline) / baseline) * 100
            : 0,
      ohlcLabel: this.describeCandle(index),
    };
  }

  private svgCoords(): { x: number; y: number }[] {
    return this._coords().map(({ x, y }) => ({ x: (x / 100) * WIDTH, y: (y / 100) * HEIGHT }));
  }

  private visibleIndicatorValues(series: readonly PricePoint[]): number[] {
    const visibleTimes = new Set(this.visibleCandles().map((candle) => candle.time.getTime()));
    return series
      .filter((point) => visibleTimes.has(point.time.getTime()))
      .map((point) => point.value);
  }

  private indicatorSvgCoords(
    series: readonly PricePoint[],
    scale: ChartScale,
  ): { x: number; y: number }[] {
    const visibleCandles = this.visibleCandles();
    const valuesByTime = new Map(series.map((point) => [point.time.getTime(), point.value]));
    const last = Math.max(visibleCandles.length - 1, 1);
    return visibleCandles.flatMap((candle, index) => {
      const value = valuesByTime.get(candle.time.getTime());
      return value === undefined
        ? []
        : [
            {
              x: (index / last) * WIDTH,
              y: (this.valueToY(value, scale) / 100) * HEIGHT,
            },
          ];
    });
  }

  private indicatorPath(series: readonly PricePoint[], scale: ChartScale): string {
    const coords = this.indicatorSvgCoords(series, scale);
    return coords.length < 2 ? '' : this.smoothPath(coords);
  }

  private smoothPath(coords: { x: number; y: number }[]): string {
    if (!coords.length) {
      return '';
    }
    if (coords.length === 1) {
      const point = coords[0];
      return `M 0,${point.y.toFixed(2)} L ${WIDTH},${point.y.toFixed(2)}`;
    }

    const command = [`M ${coords[0].x.toFixed(2)},${coords[0].y.toFixed(2)}`];
    for (let i = 0; i < coords.length - 1; i++) {
      const previous = coords[i - 1] ?? coords[i];
      const current = coords[i];
      const next = coords[i + 1];
      const afterNext = coords[i + 2] ?? next;
      const control1 = {
        x: current.x + (next.x - previous.x) / 6,
        y: current.y + (next.y - previous.y) / 6,
      };
      const control2 = {
        x: next.x - (afterNext.x - current.x) / 6,
        y: next.y - (afterNext.y - current.y) / 6,
      };
      command.push(
        `C ${control1.x.toFixed(2)},${control1.y.toFixed(2)} ${control2.x.toFixed(2)},${control2.y.toFixed(2)} ${next.x.toFixed(2)},${next.y.toFixed(2)}`,
      );
    }
    return command.join(' ');
  }

  private valueToY(value: number, scale = this.yScale()): number {
    return (
      ((HEIGHT - PADDING - ((value - scale.min) / scale.range) * (HEIGHT - PADDING * 2)) / HEIGHT) *
      100
    );
  }

  private formatValue(value: number, digits = '1.2-2'): string {
    return this.mode() === 'percent'
      ? `${formatNumber(value, this._locale, digits)}%`
      : formatCurrency(value, this._locale, '$', 'USD', digits);
  }

  private describeCandle(index: number): string {
    const candle = this.visibleCandles()[index];
    if (!candle || !this.showsCandles()) {
      return '';
    }
    return `O ${formatCurrency(candle.open, this._locale, '$', 'USD')} H ${formatCurrency(candle.high, this._locale, '$', 'USD')} L ${formatCurrency(candle.low, this._locale, '$', 'USD')} C ${formatCurrency(candle.close, this._locale, '$', 'USD')}`;
  }

  private clampMarkerPosition(value: number): number {
    return Math.min(98, Math.max(2, value));
  }

  private formatTime(time: Date, format: string): string {
    const timezone = this.timezone();
    return formatDate(
      time,
      format,
      this._locale,
      timezone.includes('/') ? this.zoneOffset(time, timezone) : timezone,
    );
  }

  private zoneOffset(time: Date, timezone: string): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(time);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);
    const localAsUtc = Date.UTC(
      value('year'),
      value('month') - 1,
      value('day'),
      value('hour'),
      value('minute'),
      value('second'),
    );
    const minutes = Math.round((localAsUtc - time.getTime()) / 60_000);
    const sign = minutes >= 0 ? '+' : '-';
    const absolute = Math.abs(minutes);
    return `${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}${String(absolute % 60).padStart(2, '0')}`;
  }
}
