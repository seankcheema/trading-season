import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { utcDay } from '../reporting/format';
import { DailyCount } from '../reporting/report.models';

// At most this many day labels sit under the plot, evenly spaced.
const MAX_AXIS_LABELS = 6;
// The SVG user space the lines are drawn in; it stretches to the plot.
const WIDTH = 100;
const HEIGHT = 40;

let nextChartId = 0;

// Round a maximum up to an even, readable axis top so the midpoint is a whole number.
export function axisTop(max: number): number {
  if (max <= 2) {
    return 2;
  }
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const top = [1, 2, 4, 5, 10].map((step) => step * magnitude).find((step) => step >= max)!;
  return top % 2 ? top + 1 : top;
}

interface Point {
  x: number;
  y: number;
}

// A smooth path through the points. Control points stay inside the plot, so a
// curve between two zero days never dips below the baseline.
export function smoothPath(points: readonly Point[]): string {
  if (!points.length) {
    return '';
  }
  const clamp = (y: number) => Math.min(HEIGHT, Math.max(0, y));
  const at = (x: number, y: number) => `${x.toFixed(2)},${clamp(y).toFixed(2)}`;
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

// Resolved orders per UTC day as two lines on one count axis: filled in the gain
// color over a faded area, rejected in the loss color. The newest day is marked
// and read out until another day is hovered or focused.
@Component({
  selector: 'app-daily-trades-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-0 flex-col' },
  template: `
    @if (days().length) {
      <div
        class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_auto] grid-rows-[1.25rem_minmax(9rem,1fr)_1rem] gap-x-3 gap-y-2"
      >
        <div class="relative min-w-0" aria-hidden="true">
          <p
            class="absolute top-0 flex gap-1 text-[13px] leading-5 whitespace-nowrap tabular-nums"
            [style.left.%]="shown().x"
            [style.transform]="anchor(shown().x)"
          >
            <span class="font-semibold">{{ shown().label }}</span>
            <span class="text-muted-foreground">
              · {{ shown().filled }} filled · {{ shown().rejected }} rejected
            </span>
          </p>
        </div>
        <div></div>

        <div class="relative min-h-0">
          @if (active() !== null) {
            <span
              class="bg-foreground/40 pointer-events-none absolute inset-y-0 w-px"
              data-crosshair
              [style.left.%]="shown().x"
            ></span>
          }
          <svg
            class="pointer-events-none absolute inset-0 size-full overflow-visible"
            viewBox="0 0 100 40"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient [attr.id]="gradientId" x1="0" x2="0" y1="0" y2="1">
                <stop class="text-gain" offset="0" stop-color="currentColor" stop-opacity="0.28" />
                <stop class="text-gain" offset="1" stop-color="currentColor" stop-opacity="0" />
              </linearGradient>
            </defs>
            @for (tick of ticks(); track tick.position) {
              <line
                class="stroke-border/60"
                x1="0"
                x2="100"
                [attr.y1]="tick.y"
                [attr.y2]="tick.y"
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
            @if (lines().area) {
              <path [attr.d]="lines().area" [attr.fill]="'url(#' + gradientId + ')'" />
            }
            <path
              class="stroke-gain"
              data-series="filled"
              [attr.d]="lines().filled"
              fill="none"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              vector-effect="non-scaling-stroke"
            />
            <path
              class="stroke-loss"
              data-series="rejected"
              [attr.d]="lines().rejected"
              fill="none"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              vector-effect="non-scaling-stroke"
            />
          </svg>
          <!-- One marker per series on the day being read out, ringed in the card color. -->
          <span
            class="bg-loss ring-card pointer-events-none absolute z-10 -translate-1/2 rounded-full ring-2"
            [class]="active() === null ? 'size-2' : 'size-2.5'"
            [style.left.%]="shown().x"
            [style.top.%]="shown().rejectedY"
          ></span>
          <span
            class="bg-gain ring-card pointer-events-none absolute z-10 -translate-1/2 rounded-full ring-2"
            [class]="active() === null ? 'size-2' : 'size-2.5'"
            [style.left.%]="shown().x"
            [style.top.%]="shown().filledY"
          ></span>
          <!-- One full-height target per day, wider than any mark. -->
          <ol class="absolute inset-0 flex" (mouseleave)="active.set(null)">
            @for (day of points(); track day.date; let index = $index) {
              <li
                class="min-w-0 flex-1 cursor-default outline-none"
                tabindex="0"
                [attr.aria-label]="
                  day.label + ': ' + day.filled + ' filled, ' + day.rejected + ' rejected'
                "
                (mouseenter)="active.set(index)"
                (focus)="active.set(index)"
                (blur)="active.set(null)"
              ></li>
            }
          </ol>
        </div>
        <!-- Right-hand axis: each number is centered on its gridline. -->
        <div
          class="border-border/70 text-muted-foreground relative border-l pl-2 text-right text-[11px] tabular-nums"
          aria-hidden="true"
        >
          <span class="invisible">{{ top() }}</span>
          @for (tick of ticks(); track tick.position) {
            <span class="absolute right-0 -translate-y-1/2" [style.top.%]="tick.position">
              {{ tick.value }}
            </span>
          }
        </div>

        <div class="text-muted-foreground relative text-xs" data-axis="days" aria-hidden="true">
          @for (label of axisLabels(); track label.date) {
            <span
              class="absolute top-0 whitespace-nowrap"
              [style.left.%]="label.x"
              [style.transform]="anchor(label.x)"
            >
              {{ label.label }}
            </span>
          }
        </div>
        <div></div>
      </div>
    } @else {
      <p class="text-muted-foreground py-10 text-center text-sm">No orders have resolved yet.</p>
    }
  `,
})
export class DailyTradesChartComponent {
  readonly days = input.required<readonly DailyCount[]>();

  // Index of the hovered or focused day.
  protected readonly active = signal<number | null>(null);
  protected readonly gradientId = `daily-trades-area-${nextChartId++}`;

  protected readonly top = computed(() =>
    axisTop(Math.max(0, ...this.days().map((day) => Math.max(day.filled, day.rejected)))),
  );

  // Gridlines and their axis numbers: position is a percentage from the top of
  // the plot, y the same height in SVG units.
  protected readonly ticks = computed(() =>
    [0, 50, 100].map((position) => ({
      position,
      y: (position / 100) * HEIGHT,
      value: this.top() * (1 - position / 100),
    })),
  );

  // Each day sits at the center of its own column, so a single day is centered.
  protected readonly points = computed(() => {
    const days = this.days();
    const top = this.top();
    return days.map((day, index) => ({
      ...day,
      label: utcDay(day.date),
      x: ((index + 0.5) / days.length) * 100,
      filledY: (1 - day.filled / top) * 100,
      rejectedY: (1 - day.rejected / top) * 100,
    }));
  });

  protected readonly lines = computed(() => {
    const points = this.points();
    const scaled = (key: 'filledY' | 'rejectedY') =>
      points.map((point) => ({ x: (point.x / 100) * WIDTH, y: (point[key] / 100) * HEIGHT }));
    const filled = scaled('filledY');
    const line = smoothPath(filled);
    return {
      filled: line,
      rejected: smoothPath(scaled('rejectedY')),
      // A single day has no span to fill.
      area:
        filled.length > 1
          ? `${line} L ${filled[filled.length - 1].x.toFixed(2)},${HEIGHT} L ${filled[0].x.toFixed(2)},${HEIGHT} Z`
          : '',
    };
  });

  // Count back from the newest day so the latest point always carries a label.
  protected readonly axisLabels = computed(() => {
    const points = this.points();
    const every = Math.max(1, Math.ceil(points.length / MAX_AXIS_LABELS));
    return points.filter((_, index) => (points.length - 1 - index) % every === 0);
  });

  // The day in the readout: the one under the pointer, otherwise the newest.
  protected readonly shown = computed(() => {
    const points = this.points();
    return points[this.active() ?? points.length - 1] ?? points[points.length - 1];
  });

  // Keeps a label that is centered on a point from running off either edge.
  protected anchor(x: number): string {
    return x < 12 ? 'translateX(0)' : x > 88 ? 'translateX(-100%)' : 'translateX(-50%)';
  }
}
