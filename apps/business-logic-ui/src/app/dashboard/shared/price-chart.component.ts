import { formatCurrency, formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  booleanAttribute,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { PricePoint, Timeframe } from '../mock-data';
import { SignedPercentPipe } from './signed-percent.pipe';

const WIDTH = 100;
const HEIGHT = 40;
const PADDING = 2;
const MAX_TICKS = 6;
const VALUE_TICKS = 5;

let nextId = 0;

const AXIS_FORMATS: Record<Timeframe, string> = {
  '1D': 'h:mm a',
  '5D': 'EEE d',
  '1M': 'MMM d',
  '1Y': "MMM ''yy",
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
  // Hidden on narrow screens so labels don't collide.
  minor: boolean;
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

@Component({
  selector: 'app-price-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SignedPercentPipe],
  host: { class: 'flex flex-col' },
  template: `
    <div
      class="relative grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_4.75rem] grid-rows-[minmax(0,1fr)_1rem] gap-x-3 gap-y-2"
    >
      @if (tooltipPoint(); as point) {
        <div
          class="pointer-events-none absolute top-0 z-20"
          [class]="hovered() ? '' : 'invisible'"
          [style.left.%]="point.x"
          [style.transform]="edgeTransform(point.x)"
          aria-hidden="true"
        >
          <div
            class="border-border bg-popover w-fit rounded-[5px] border px-2 py-0.5 leading-tight whitespace-nowrap shadow-lg"
          >
            <p class="text-sm font-semibold">{{ point.valueLabel }}</p>
            <p class="text-muted-foreground text-[11px]">
              <span [class]="point.changePercent >= 0 ? 'text-gain' : 'text-loss'">
                {{ point.changePercent | signedPercent }}
              </span>
              · {{ point.timeLabel }}
            </p>
          </div>
        </div>
      }

      <div
        #plot
        tabindex="0"
        role="group"
        class="focus-visible:ring-ring/50 relative min-h-0 touch-pan-y rounded-[2px] outline-none focus-visible:ring-2"
        [attr.aria-label]="ariaLabel()"
        (pointermove)="onPointerMove($event, plot)"
        (pointerdown)="onPointerMove($event, plot)"
        (pointerleave)="hoverIndex.set(null)"
        (keydown)="onKeydown($event)"
        (blur)="hoverIndex.set(null)"
      >
        @if (hovered(); as point) {
          <div
            class="bg-foreground/40 pointer-events-none absolute inset-y-0 w-px"
            [style.left.%]="point.x"
          ></div>
          <div
            class="bg-foreground/40 pointer-events-none absolute inset-x-0 h-px"
            [style.top.%]="point.y"
          ></div>
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
        @if (hovered(); as point) {
          <span
            class="price-hover-marker bg-foreground text-background absolute right-0 -translate-y-1/2 rounded-[3px] px-1.5 py-0.5 text-[11px] font-medium shadow-sm"
            [style.top.%]="point.y"
          >
            {{ point.valueLabel }}
          </span>
        }
      </div>

      <div class="text-muted-foreground relative h-4 text-xs" aria-hidden="true">
        @for (tick of ticks(); track tick.index) {
          <span
            class="absolute top-0 whitespace-nowrap"
            [class]="tick.minor ? 'max-sm:hidden' : ''"
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
})
export class PriceChartComponent {
  readonly points = input.required<PricePoint[]>();
  readonly timeframe = input.required<Timeframe>();
  readonly timezone = input('UTC');
  // Fills the space under the line with a gradient in the trend color.
  readonly area = input(false, { transform: booleanAttribute });

  private readonly _locale = inject(LOCALE_ID);
  protected readonly gradientId = `price-chart-area-${nextId++}`;

  protected readonly WIDTH = WIDTH;
  protected readonly HEIGHT = HEIGHT;
  protected readonly viewBox = `0 0 ${WIDTH} ${HEIGHT}`;
  protected readonly hoverIndex = signal<number | null>(null);

  protected readonly trendingUp = computed(() => {
    const values = this.points();
    return values.length < 2 || values[values.length - 1].value >= values[0].value;
  });

  private readonly yScale = computed<ChartScale>(() => {
    const values = this.points().map((point) => point.value);
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
    const points = this.points();
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

  protected readonly hovered = computed(() => {
    const index = this.hoverIndex();
    return index === null ? null : this.describePoint(index);
  });

  protected readonly persistentPoint = computed<MarkerPoint | null>(() => {
    if (this.hovered()) {
      return null;
    }
    const points = this.points();
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

  // What the tooltip row renders: the hovered point, or the latest one as an invisible
  // placeholder that reserves the row's height.
  protected readonly tooltipPoint = computed(
    () => this.hovered() ?? this.describePoint(this.points().length - 1),
  );

  // Labels at the points where the axis label changes (e.g. each new day), thinned to fit.
  protected readonly ticks = computed<AxisTick[]>(() => {
    const points = this.points();
    const format = AXIS_FORMATS[this.timeframe()];
    const last = Math.max(points.length - 1, 1);

    const candidates: { index: number; label: string }[] = [];
    points.forEach((point, index) => {
      const label = this.formatTime(point.time, format);
      if (candidates[candidates.length - 1]?.label !== label) {
        candidates.push({ index, label });
      }
    });

    const stride = Math.ceil(candidates.length / MAX_TICKS);
    return candidates
      .filter((_, i) => i % stride === 0)
      .map(({ index, label }, i) => {
        const x = (index / last) * 100;
        return {
          index,
          label,
          x,
          svgX: (x / 100) * WIDTH,
          transform: this.edgeTransform(x),
          minor: i % 2 === 1,
        };
      });
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
    const points = this.points();
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

  // Keeps labels near the edges from spilling outside the chart.
  protected edgeTransform(x: number): string {
    if (x < 12) return 'translateX(0)';
    if (x > 88) return 'translateX(-100%)';
    return 'translateX(-50%)';
  }

  protected onPointerMove(event: PointerEvent, plot: HTMLElement): void {
    const count = this.points().length;
    if (!count) {
      return;
    }
    const rect = plot.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    this.hoverIndex.set(Math.round(ratio * (count - 1)));
  }

  protected onKeydown(event: KeyboardEvent): void {
    const last = this.points().length - 1;
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
    const points = this.points();
    const point = points[index];
    if (!point) {
      return null;
    }
    return {
      ...this._coords()[index],
      valueLabel: formatCurrency(point.value, this._locale, '$', 'USD'),
      timeLabel: this.formatTime(point.time, TOOLTIP_FORMATS[this.timeframe()]),
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
      ((HEIGHT - PADDING - ((value - scale.min) / scale.range) * (HEIGHT - PADDING * 2)) /
        HEIGHT) *
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
