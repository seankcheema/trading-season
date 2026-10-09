import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  booleanAttribute,
  computed,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { wholeDollars } from '../reporting/format';

// The SVG user space the line is drawn in; it stretches to the plot.
const WIDTH = 100;
const HEIGHT = 40;
// Room above the highest and below the lowest point, in SVG units.
const PAD = 2;
const AXIS_LABELS = 5;
// How many steps the value axis aims for; rounding the step can add or drop one.
const AXIS_STEPS = 4;

let nextChartId = 0;

export interface ChartPoint {
  value: number;
  // What the point is called in the hover readout, such as "3 PM" or "Oct 8".
  label: string;
}

interface Coordinate {
  x: number;
  y: number;
}

export interface AxisScale {
  min: number;
  max: number;
  // The labelled values, highest first.
  ticks: number[];
}

// Rounds a step up to 1, 2, 2.5 or 5 times a power of ten.
function roundStep(rough: number): number {
  const power = 10 ** Math.floor(Math.log10(rough));
  const unit = rough / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10) * power;
}

// Round bounds that hold every value, and the round steps between them, so the
// axis reads $80,000, $60,000 and not $75,542, $56,657. A series that never
// moves has one tick, its value: there is no range to divide.
export function axisScale(values: readonly number[], fromZero = false): AxisScale {
  let min = values.length ? Math.min(...values) : 0;
  let max = values.length ? Math.max(...values) : 0;
  if (fromZero) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  if (max === min) {
    return { min, max, ticks: [max] };
  }
  const step = roundStep((max - min) / AXIS_STEPS);
  const low = Math.floor(min / step);
  const high = Math.ceil(max / step);
  // From whole multiples of the step, so 0.1 steps do not drift into 0.30000000000000004.
  const at = (index: number) => Number((index * step).toPrecision(12));
  return {
    min: at(low),
    max: at(high),
    ticks: Array.from({ length: high - low + 1 }, (_, index) => at(high - index)),
  };
}

// A smooth path through the points, in SVG units. Control points stay inside the
// plot, so the curve between two low points never dips under the baseline.
export function smoothPath(points: readonly Coordinate[]): string {
  if (!points.length) {
    return '';
  }
  const inside = (y: number) => Math.min(HEIGHT, Math.max(0, y));
  const at = (x: number, y: number) => `${x.toFixed(2)},${inside(y).toFixed(2)}`;
  let path = `M ${at(points[0].x, points[0].y)}`;
  for (let index = 0; index < points.length - 1; index++) {
    const before = points[index - 1] ?? points[index];
    const from = points[index];
    const to = points[index + 1];
    const after = points[index + 2] ?? to;
    path +=
      ` C ${at(from.x + (to.x - before.x) / 6, from.y + (to.y - before.y) / 6)}` +
      ` ${at(to.x - (after.x - from.x) / 6, to.y - (after.y - from.y) / 6)}` +
      ` ${at(to.x, to.y)}`;
  }
  return path;
}

// The design system's line chart: a smooth 2px line in the gain or loss color,
// an optional faded area, hairline gridlines, the value axis on the right in
// round steps, a ringed marker on the newest point, and a crosshair with a
// label row on hover.
@Component({
  selector: 'app-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-h-0' },
  template: `
    <div
      class="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_4.75rem] grid-rows-[1.25rem_minmax(4rem,1fr)_1rem] gap-x-3 gap-y-2"
    >
      <div class="relative min-w-0" aria-hidden="true">
        @if (hovered(); as point) {
          <p
            class="absolute top-0 flex gap-1 text-[13px] leading-5 whitespace-nowrap tabular-nums"
            [style.left.%]="point.x"
            [style.transform]="anchor(point.x)"
          >
            <span class="font-semibold">{{ format()(point.value) }}</span>
            <span class="text-muted-foreground">· {{ point.label }}</span>
          </p>
        }
      </div>
      <div></div>

      <div
        #plot
        class="relative min-h-0 touch-pan-y rounded-xs"
        role="img"
        [attr.aria-label]="description()"
        (pointermove)="track($event)"
        (pointerleave)="active.set(null)"
      >
        @if (hovered(); as point) {
          <span
            class="bg-foreground/40 pointer-events-none absolute inset-y-0 w-px"
            data-crosshair
            [style.left.%]="point.x"
          ></span>
        }
        <svg
          class="pointer-events-none absolute inset-0 size-full overflow-visible"
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          @if (area()) {
            <defs>
              <linearGradient [attr.id]="gradientId" x1="0" x2="0" y1="0" y2="1">
                <stop [class]="text()" offset="0" stop-color="currentColor" stop-opacity="0.28" />
                <stop [class]="text()" offset="1" stop-color="currentColor" stop-opacity="0" />
              </linearGradient>
            </defs>
          }
          @for (tick of yTicks(); track $index) {
            <line
              class="stroke-border/60"
              x1="0"
              x2="100"
              [attr.y1]="tick.svgY"
              [attr.y2]="tick.svgY"
              stroke-width="0.5"
              vector-effect="non-scaling-stroke"
            />
          }
          @for (tick of xTicks(); track $index) {
            <line
              class="stroke-border/35"
              [attr.x1]="tick.x"
              [attr.x2]="tick.x"
              y1="0"
              y2="40"
              stroke-width="0.5"
              vector-effect="non-scaling-stroke"
            />
          }
          <line
            class="stroke-border"
            x1="0"
            x2="100"
            y1="40"
            y2="40"
            stroke-width="0.5"
            vector-effect="non-scaling-stroke"
          />
          @if (area() && coordinates().length > 1) {
            <path [attr.d]="line() + ' L 100,40 L 0,40 Z'" [attr.fill]="'url(#' + gradientId + ')'" />
          }
          <path
            [class]="stroke()"
            data-line
            [attr.d]="line()"
            fill="none"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
          />
        </svg>
        @if (marker(); as point) {
          <span
            class="ring-card pointer-events-none absolute z-10 -translate-1/2 rounded-full ring-2"
            [class]="(hovered() ? 'size-2.5 ' : 'size-2 ') + fill()"
            data-marker
            [style.left.%]="point.x"
            [style.top.%]="point.top"
          ></span>
        }
      </div>
      <div
        class="border-border/70 text-muted-foreground relative min-h-0 border-l text-right text-[11px] tabular-nums"
        aria-hidden="true"
      >
        @for (tick of yTicks(); track $index) {
          <span
            class="absolute right-0 -translate-y-1/2 whitespace-nowrap"
            [style.top.%]="tick.y"
          >
            {{ format()(tick.value) }}
          </span>
        }
      </div>

      <div class="text-muted-foreground relative h-4 text-xs" data-axis="x" aria-hidden="true">
        @for (tick of xTicks(); track $index) {
          <span
            class="absolute top-0 whitespace-nowrap"
            [style.left.%]="tick.x"
            [style.transform]="anchor(tick.x)"
          >
            {{ tick.label }}
          </span>
        }
      </div>
      <div></div>
    </div>
  `,
})
export class LineChartComponent {
  readonly points = input.required<readonly ChartPoint[]>();
  // Which way the period went, which colors the line.
  readonly tone = input<'gain' | 'loss'>('gain');
  readonly area = input(false, { transform: booleanAttribute });
  // Starts the value axis at zero, for a quantity such as volume where the
  // height above zero is the point. Without it the axis fits the values.
  readonly fromZero = input(false, { transform: booleanAttribute });
  readonly format = input<(value: number) => string>(wholeDollars);
  // What a screen reader is told the chart shows.
  readonly description = input('');

  private readonly _plot = viewChild.required<ElementRef<HTMLElement>>('plot');

  // Index of the point under the pointer.
  protected readonly active = signal<number | null>(null);
  protected readonly gradientId = `line-chart-area-${nextChartId++}`;

  protected readonly stroke = computed(() => (this.tone() === 'gain' ? 'stroke-gain' : 'stroke-loss'));
  protected readonly fill = computed(() => (this.tone() === 'gain' ? 'bg-gain' : 'bg-loss'));
  protected readonly text = computed(() => (this.tone() === 'gain' ? 'text-gain' : 'text-loss'));

  private readonly _scale = computed(() => {
    const scale = axisScale(
      this.points().map((point) => point.value),
      this.fromZero(),
    );
    return { ...scale, range: scale.max - scale.min || 1 };
  });

  // Distance from the top of the plot, in percent, for a value.
  private top(value: number): number {
    const { min, range } = this._scale();
    return ((HEIGHT - PAD - ((value - min) / range) * (HEIGHT - PAD * 2)) / HEIGHT) * 100;
  }

  protected readonly coordinates = computed(() => {
    const points = this.points();
    const last = Math.max(points.length - 1, 1);
    return points.map((point, index) => ({
      ...point,
      x: (index / last) * 100,
      top: this.top(point.value),
    }));
  });

  protected readonly line = computed(() =>
    smoothPath(
      this.coordinates().map((point) => ({
        x: (point.x / 100) * WIDTH,
        y: (point.top / 100) * HEIGHT,
      })),
    ),
  );

  protected readonly yTicks = computed(() =>
    this._scale().ticks.map((value) => {
      const y = this.top(value);
      return { value, y, svgY: (y / 100) * HEIGHT };
    }),
  );

  // A handful of the point labels, evenly spread and always ending on the newest.
  protected readonly xTicks = computed(() => {
    const points = this.coordinates();
    const count = Math.min(AXIS_LABELS, points.length);
    return Array.from({ length: count }, (_, index) => {
      const point = points[count === 1 ? 0 : Math.round((index / (count - 1)) * (points.length - 1))];
      return { x: point.x, label: point.label };
    });
  });

  protected readonly hovered = computed(() => {
    const index = this.active();
    return index === null ? null : (this.coordinates()[index] ?? null);
  });

  // The point that carries the marker: the hovered one, otherwise the newest.
  protected readonly marker = computed(() => {
    const points = this.coordinates();
    return this.hovered() ?? points[points.length - 1] ?? null;
  });

  protected track(event: PointerEvent): void {
    const count = this.points().length;
    if (!count) {
      return;
    }
    const box = this._plot().nativeElement.getBoundingClientRect();
    const share = box.width ? Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)) : 0;
    this.active.set(Math.round(share * (count - 1)));
  }

  // Keeps a label that is centered on a point from running off either edge.
  protected anchor(x: number): string {
    return x < 12 ? 'translateX(0)' : x > 88 ? 'translateX(-100%)' : 'translateX(-50%)';
  }
}
