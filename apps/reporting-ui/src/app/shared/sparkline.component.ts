import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const WIDTH = 100;
const HEIGHT = 24;
const PAD = 3;

// A row-sized trend: a dashed baseline at the first value, the line in the gain
// color when it ends at or above where it began and the loss color when below,
// and a dot on the newest value.
@Component({
  selector: 'app-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-6 w-full min-w-0' },
  template: `
    @if (shape(); as shape) {
      <svg
        class="block size-full overflow-visible"
        viewBox="0 0 100 24"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line
          class="stroke-border/70"
          x1="0"
          x2="100"
          [attr.y1]="shape.baseline"
          [attr.y2]="shape.baseline"
          stroke-width="1"
          stroke-dasharray="3 3"
          vector-effect="non-scaling-stroke"
        />
        <path
          [class]="shape.up ? 'stroke-gain' : 'stroke-loss'"
          [attr.d]="shape.path"
          fill="none"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
        <circle
          [class]="shape.up ? 'fill-gain' : 'fill-loss'"
          [attr.cx]="shape.end[0]"
          [attr.cy]="shape.end[1]"
          r="1.8"
        />
      </svg>
    }
  `,
})
export class SparklineComponent {
  readonly points = input.required<readonly number[]>();

  protected readonly shape = computed(() => {
    const points = this.points();
    if (!points.length) {
      return null;
    }
    const base = points[0];
    const min = Math.min(...points);
    const range = Math.max(...points) - min || 1;
    const y = (value: number) => HEIGHT - PAD - ((value - min) / range) * (HEIGHT - PAD * 2);
    const last = Math.max(points.length - 1, 1);
    const coordinates = points.map((value, index) => [(index / last) * WIDTH, y(value)] as const);
    return {
      baseline: y(base),
      up: points[points.length - 1] >= base,
      path: coordinates
        .map(([x, top], index) => `${index ? 'L' : 'M'}${x.toFixed(2)},${top.toFixed(2)}`)
        .join(' '),
      end: coordinates[coordinates.length - 1],
    };
  });
}
