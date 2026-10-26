import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * A forecast's record as an icon array: one cell per closed call or week, the right ones filled.
 * Showing every cell of the denominator, not only the latest few, keeps the picture in step with
 * the "right 15 of last 20" beside it; icon arrays like this help readers weigh a frequency
 * against its denominator. Cells are grouped, right ones first, so the share reads at a glance.
 */
@Component({
  selector: 'app-forecast-track',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'img',
    '[attr.aria-label]': 'label()',
  },
  template: `
    @for (hit of cells(); track $index) {
      <span class="cell" [class.hit]="hit"></span>
    }
  `,
  styles: `
    :host {
      display: inline-grid;
      grid-auto-flow: column;
      gap: 2px;
      vertical-align: middle;
    }
    .cell {
      width: 4px;
      height: 10px;
      border-radius: 1px;
      background: color-mix(in srgb, var(--foreground) 18%, transparent);
    }
    .cell.hit {
      background: var(--primary);
    }
  `,
})
export class ForecastTrackComponent {
  readonly hits = input.required<number>();
  readonly total = input.required<number>();
  readonly unit = input<'calls' | 'weeks'>('calls');

  protected readonly cells = computed(() =>
    Array.from({ length: Math.max(0, this.total()) }, (_, i) => i < this.hits()),
  );
  protected readonly label = computed(
    () => `Right on ${this.hits()} of the last ${this.total()} ${this.unit()}`,
  );
}
