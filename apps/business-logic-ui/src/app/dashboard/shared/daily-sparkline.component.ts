import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PricePoint } from '../mock-data';

const WIDTH = 100;
const HEIGHT = 24;
const PADDING = 3;

interface ChartScale {
  min: number;
  max: number;
  range: number;
}

@Component({
  selector: 'app-daily-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0' },
  template: `
    <span class="block h-6 w-full" role="img" [attr.aria-label]="ariaLabel()">
      <svg
        [attr.viewBox]="viewBox"
        preserveAspectRatio="none"
        class="block h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <line
          x1="0"
          [attr.y1]="baselineY()"
          [attr.x2]="WIDTH"
          [attr.y2]="baselineY()"
          class="stroke-border/70"
          data-testid="sparkline-baseline"
          stroke-width="1"
          stroke-dasharray="3 3"
          vector-effect="non-scaling-stroke"
        />
        @if (linePath()) {
          <path
            [attr.d]="linePath()"
            class="fill-none"
            [class.stroke-gain]="trendingUp()"
            [class.stroke-loss]="!trendingUp()"
            data-testid="sparkline-path"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
          />
        }
        @if (latestPoint(); as point) {
          <circle
            [attr.cx]="point.x"
            [attr.cy]="point.y"
            r="1.8"
            [class.fill-gain]="trendingUp()"
            [class.fill-loss]="!trendingUp()"
          />
        }
      </svg>
    </span>
  `,
})
export class DailySparklineComponent {
  readonly symbol = input.required<string>();
  readonly points = input.required<PricePoint[]>();

  protected readonly WIDTH = WIDTH;
  protected readonly viewBox = `0 0 ${WIDTH} ${HEIGHT}`;

  protected readonly baseline = computed(() => this.points()[0]?.value ?? 0);

  private readonly scale = computed<ChartScale>(() => {
    const values = this.points().map((point) => point.value);
    if (!values.length) {
      return { min: 0, max: 1, range: 1 };
    }
    const min = Math.min(...values, this.baseline());
    const max = Math.max(...values, this.baseline());
    const range = max - min || Math.max(Math.abs(max) * 0.02, 1);
    return { min, max: min + range, range };
  });

  private readonly coords = computed(() => {
    const points = this.points();
    const last = Math.max(points.length - 1, 1);
    return points.map((point, index) => ({
      x: points.length === 1 ? WIDTH / 2 : (index / last) * WIDTH,
      y: this.valueToY(point.value),
    }));
  });

  protected readonly trendingUp = computed(() => {
    const points = this.points();
    return points.length < 2 || points[points.length - 1].value >= this.baseline();
  });

  protected readonly baselineY = computed(() => this.valueToY(this.baseline()));

  protected readonly linePath = computed(() => {
    const coords = this.coords();
    if (!coords.length) {
      return '';
    }
    if (coords.length === 1) {
      return `M ${coords[0].x.toFixed(2)},${coords[0].y.toFixed(2)}`;
    }
    return coords
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)},${point.y.toFixed(2)}`)
      .join(' ');
  });

  protected readonly latestPoint = computed(() => this.coords()[this.coords().length - 1] ?? null);

  protected readonly ariaLabel = computed(() => {
    const points = this.points();
    if (!points.length) {
      return `${this.symbol()} today chart, no data`;
    }
    const latest = points[points.length - 1].value;
    const relation = latest >= this.baseline() ? 'above baseline' : 'below baseline';
    return `${this.symbol()} today chart, ${relation}`;
  });

  private valueToY(value: number): number {
    const scale = this.scale();
    return HEIGHT - PADDING - ((value - scale.min) / scale.range) * (HEIGHT - PADDING * 2);
  }
}
