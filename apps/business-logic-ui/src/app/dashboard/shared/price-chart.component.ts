import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const WIDTH = 100;
const HEIGHT = 40;
const PADDING = 2;

// Minimal line chart placeholder until a charting library is chosen.
@Component({
  selector: 'app-price-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <svg
      [attr.viewBox]="viewBox"
      preserveAspectRatio="none"
      class="h-full w-full overflow-visible"
      role="img"
      [attr.aria-label]="trendingUp() ? 'Price trending up' : 'Price trending down'"
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
  `,
})
export class PriceChartComponent {
  readonly points = input.required<number[]>();

  protected readonly viewBox = `0 0 ${WIDTH} ${HEIGHT}`;

  protected readonly trendingUp = computed(() => {
    const values = this.points();
    return values.length < 2 || values[values.length - 1] >= values[0];
  });

  protected readonly polylinePoints = computed(() => {
    const values = this.points();
    if (values.length < 2) {
      return '';
    }
    const min = Math.min(...values);
    const range = Math.max(...values) - min || 1;
    const step = WIDTH / (values.length - 1);
    return values
      .map((value, i) => {
        const y = HEIGHT - PADDING - ((value - min) / range) * (HEIGHT - PADDING * 2);
        return `${(i * step).toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  });
}
