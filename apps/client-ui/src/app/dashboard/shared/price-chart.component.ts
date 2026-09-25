import { formatCurrency, formatDate, formatNumber } from '@angular/common';
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

interface VolumeBar {
  x: number;
  width: number;
  height: number;
  up: boolean;
}

@Component({
  selector: 'app-price-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SignedPercentPipe],
  host: { class: 'flex flex-col' },
  template: `
    <div
      class="relative grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_4.75rem] grid-rows-[1.25rem_minmax(0,1fr)_1rem] gap-x-3 gap-y-2"
    >
      @if (interactive()) {
        <div
          class="border-border bg-card/90 absolute top-0 left-0 z-30 flex items-center gap-0.5 rounded-lg border p-0.5 backdrop-blur-sm"
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
          <span class="text-muted-foreground px-1 text-[10px] tabular-nums"
            >{{ visiblePoints().length }} bars</span
          >
        </div>
      }
      <div class="relative min-w-0" aria-hidden="true">
        @if (tooltipPoint(); as point) {
          <div
            class="price-hover-label pointer-events-none absolute top-0 whitespace-nowrap tabular-nums"
            [class]="hovered() ? '' : 'invisible'"
            [style.left.%]="point.x"
            [style.transform]="edgeTransform(point.x)"
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
          </div>
        }
      </div>
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
          [attr.viewBox]="viewBox"
          preserveAspectRatio="none"
          class="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          aria-hidden="true"
        >
          @if (area()) {
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
          <line
            x1="0"
            [attr.y1]="HEIGHT"
            [attr.x2]="WIDTH"
            [attr.y2]="HEIGHT"
            class="stroke-border"
            stroke-width="0.5"
            vector-effect="non-scaling-stroke"
          />
          @if (area() && areaPath()) {
            <path [attr.d]="areaPath()" [attr.fill]="'url(#' + gradientId + ')'" />
          }
          @for (bar of volumeBars(); track $index) {
            <rect
              [attr.x]="bar.x"
              [attr.y]="HEIGHT - bar.height"
              [attr.width]="bar.width"
              [attr.height]="bar.height"
              [class]="bar.up ? 'fill-gain/45' : 'fill-loss/45'"
            />
          }
          <path
            [attr.d]="linePath()"
            fill="none"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
            [class]="trendingUp() ? 'stroke-gain' : 'stroke-loss'"
          />
        </svg>

        @if (persistentPoint(); as point) {
          <div
            class="price-current-marker ring-card pointer-events-none absolute z-10 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-sm ring-2"
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
  `,
  styles: `
    .chart-control {
      min-width: 1.5rem;
      height: 1.5rem;
      border-radius: 0.375rem;
      color: var(--muted-foreground);
      font-size: 0.6875rem;
      line-height: 1;
      cursor: pointer;
    }
    .chart-control:hover:not(:disabled) {
      background: var(--muted);
      color: var(--primary);
    }
    .chart-control:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
  `,
})
export class PriceChartComponent {
  readonly points = input.required<PricePoint[]>();
  readonly timeframe = input.required<Timeframe>();
  readonly timezone = input('UTC');
  readonly interactive = input(false, { transform: booleanAttribute });
  readonly interactionKey = input('');
  // Fills the space under the line with a gradient in the trend color.
  readonly area = input(false, { transform: booleanAttribute });

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
    const points = this.points();
    if (!this.interactive()) {
      return points;
    }
    const count = Math.min(points.length, this.viewCount());
    const start = Math.min(this.viewStart(), Math.max(0, points.length - count));
    return points.slice(start, start + count);
  });
  protected readonly atLatest = computed(
    () => this.viewStart() + this.visiblePoints().length >= this.points().length,
  );
  protected readonly canZoomIn = computed(
    () => this.visiblePoints().length > Math.min(MIN_VISIBLE_POINTS, this.points().length),
  );
  protected readonly canZoomOut = computed(
    () => this.visiblePoints().length < this.points().length,
  );
  private readonly seriesKey = computed(
    () =>
      `${this.interactive()}:${this.interactionKey()}:${this.timeframe()}:${this.points().length ? 'ready' : 'empty'}`,
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

  private readonly yScale = computed<ChartScale>(() => {
    const values = this.visiblePoints().map((point) => point.value);
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
    return points.map(({ value }, i) => ({
      x: (i / last) * 100,
      y: this.valueToY(value, scale),
    }));
  });

  protected readonly linePath = computed(() => this.smoothPath(this.svgCoords()));

  // The line's path closed along the bottom edge of the chart.
  protected readonly areaPath = computed(() => {
    const line = this.linePath();
    return line ? `${line} L ${WIDTH},${HEIGHT} L 0,${HEIGHT} Z` : '';
  });

  protected readonly trendColor = computed(() =>
    this.trendingUp() ? 'var(--color-gain)' : 'var(--color-loss)',
  );

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
        height: HEIGHT * (0.04 + normalized * 0.2),
        up: index === 0 || point.value >= points[index - 1].value,
      };
    });
  });

  protected readonly hovered = computed(() => {
    const index = this.hoverIndex();
    return index === null ? null : this.describePoint(index);
  });

  protected readonly persistentPoint = computed<MarkerPoint | null>(() => {
    if (this.hovered()) {
      return null;
    }
    const points = this.visiblePoints();
    if (!points.length) {
      return { x: 50, y: 50 };
    }
    if (points.length === 1) {
      return { x: 50, y: this.clampMarkerPosition(this.describePoint(0)?.y ?? 50) };
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

  // Labels on round boundaries of the timeframe — 8:00, 8:15, 8:30, or whole days and
  // months — widened until they fit the chart's current width.
  protected readonly ticks = computed<AxisTick[]>(() => {
    const points = this.visiblePoints();
    const timeframe = this.timeframe();
    const format = AXIS_FORMATS[timeframe];
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
        const x = (index / last) * 100;
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
        label: formatCurrency(value, this._locale, '$', 'USD', '1.0-0'),
      };
    });
  });

  protected readonly ariaLabel = computed(() => {
    const points = this.visiblePoints();
    if (!points.length) {
      return 'Price chart, no data';
    }
    const format = TOOLTIP_FORMATS[this.timeframe()];
    const first = points[0];
    const latest = points[points.length - 1];
    return (
      `Price chart from ${this.formatTime(first.time, format)} to ${this.formatTime(latest.time, format)}, ` +
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
    this.hoverIndex.set(Math.round(ratio * (count - 1)));
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
      Math.min(MIN_VISIBLE_POINTS, this.points().length),
      Math.min(this.points().length, Math.round(oldCount * factor)),
    );
    this.setView(this.viewStart() + (oldCount - nextCount) * anchor, nextCount);
  }

  protected pan(amount: number): void {
    this.setView(this.viewStart() + this.viewCount() * amount, this.viewCount());
  }

  protected goLatest(): void {
    this.setView(this.points().length - this.viewCount(), this.viewCount());
  }

  protected resetView(): void {
    const count = Math.min(DEFAULT_VISIBLE_POINTS, this.points().length);
    this.setView(this.points().length - count, count);
  }

  private setView(start: number, count: number): void {
    const safeCount = Math.max(0, Math.min(this.points().length, Math.round(count)));
    const safeStart = Math.max(0, Math.min(this.points().length - safeCount, Math.round(start)));
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
    return {
      ...this._coords()[index],
      valueLabel: formatCurrency(point.value, this._locale, '$', 'USD'),
      timeLabel: this.formatTime(point.time, TOOLTIP_FORMATS[this.timeframe()]),
      volumeLabel:
        point.volume === undefined ? '' : formatNumber(point.volume, this._locale, '1.0-0'),
      changePercent: ((point.value - points[0].value) / points[0].value) * 100,
    };
  }

  private svgCoords(): { x: number; y: number }[] {
    return this._coords().map(({ x, y }) => ({ x: (x / 100) * WIDTH, y: (y / 100) * HEIGHT }));
  }

  private smoothPath(coords: { x: number; y: number }[]): string {
    if (!coords.length) {
      return '';
    }
    if (coords.length === 1) {
      const point = coords[0];
      return `M ${point.x.toFixed(2)},${point.y.toFixed(2)}`;
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
