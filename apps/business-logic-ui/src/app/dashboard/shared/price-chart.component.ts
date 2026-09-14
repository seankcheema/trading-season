import { formatCurrency, formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
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

const AXIS_FORMATS: Record<Timeframe, string> = {
  '1D': 'h:mm a',
  '5D': 'EEE d',
  '1W': 'EEE d',
  '1M': 'MMM d',
  '1Y': "MMM ''yy",
};

const TOOLTIP_FORMATS: Record<Timeframe, string> = {
  '1D': 'h:mm a',
  '5D': 'EEE, MMM d, h:mm a',
  '1W': 'EEE, MMM d, h:mm a',
  '1M': 'EEE, MMM d, y',
  '1Y': 'MMM d, y',
};

interface AxisTick {
  index: number;
  x: number;
  label: string;
  transform: string;
  // Hidden on narrow screens so labels don't collide.
  minor: boolean;
}

// Minimal line chart placeholder until a charting library is chosen.
@Component({
  selector: 'app-price-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SignedPercentPipe],
  host: { class: 'flex flex-col' },
  template: `
    <!--
      The tooltip lives in its own row above the plot rather than floating over it, so it can
      never hide the line. It stays in the layout (invisible) when nothing is hovered, which
      keeps the row's height -- and therefore the plot -- from jumping.
    -->
    @if (tooltipPoint(); as point) {
      <div class="shrink-0 pb-2" aria-hidden="true">
        <div
          class="border-border bg-popover relative w-fit rounded-[5px] border px-2 py-1 whitespace-nowrap shadow-lg"
          [class]="hovered() ? '' : 'invisible'"
          [style.left.%]="point.x"
          [style.transform]="edgeTransform(point.x)"
        >
          <p class="font-semibold">{{ point.valueLabel }}</p>
          <p class="text-muted-foreground text-xs">
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
      class="focus-visible:ring-ring/50 relative min-h-0 flex-1 touch-pan-y rounded-[2px] outline-none focus-visible:ring-2"
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
      }

      <svg
        [attr.viewBox]="viewBox"
        preserveAspectRatio="none"
        class="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <polyline
          [attr.points]="polylinePoints()"
          fill="none"
          stroke-width="2"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
          [class]="trendingUp() ? 'stroke-gain' : 'stroke-loss'"
        />
      </svg>

      @if (hovered(); as point) {
        <div
          class="ring-card pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2"
          [class]="trendingUp() ? 'bg-gain' : 'bg-loss'"
          [style.left.%]="point.x"
          [style.top.%]="point.y"
        ></div>
      }
    </div>

    <div class="text-muted-foreground relative mt-2 h-4 shrink-0 text-xs" aria-hidden="true">
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
  `,
})
export class PriceChartComponent {
  readonly points = input.required<PricePoint[]>();
  readonly timeframe = input.required<Timeframe>();

  private readonly _locale = inject(LOCALE_ID);

  protected readonly viewBox = `0 0 ${WIDTH} ${HEIGHT}`;
  protected readonly hoverIndex = signal<number | null>(null);

  protected readonly trendingUp = computed(() => {
    const values = this.points();
    return values.length < 2 || values[values.length - 1].value >= values[0].value;
  });

  // Point positions as percentages of the plot area.
  private readonly _coords = computed(() => {
    const points = this.points();
    const values = points.map((point) => point.value);
    const min = Math.min(...values);
    const range = Math.max(...values) - min || 1;
    const last = Math.max(points.length - 1, 1);
    return values.map((value, i) => ({
      x: (i / last) * 100,
      y: ((HEIGHT - PADDING - ((value - min) / range) * (HEIGHT - PADDING * 2)) / HEIGHT) * 100,
    }));
  });

  protected readonly polylinePoints = computed(() =>
    this._coords()
      .map(({ x, y }) => `${((x / 100) * WIDTH).toFixed(2)},${((y / 100) * HEIGHT).toFixed(2)}`)
      .join(' '),
  );

  protected readonly hovered = computed(() => {
    const index = this.hoverIndex();
    return index === null ? null : this.describePoint(index);
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
        return { index, label, x, transform: this.edgeTransform(x), minor: i % 2 === 1 };
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

  private formatTime(time: Date, format: string): string {
    return formatDate(time, format, this._locale, 'UTC');
  }
}
