import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ForecastRecord } from './dua-insights';

/**
 * A forecast's confidence score: how often its recent calls were right, as one percentage with a
 * slim bar filled to it. Percentages are as easy to read as "15 of 20" and quicker to scan; the
 * frequency behind the score stays in the details. On a week with no call there is nothing to be
 * confident in, so it says how often the forecast is right when it does call.
 */
@Component({
  selector: 'app-forecast-confidence',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="bar" aria-hidden="true"
      ><span class="fill" [style.width.%]="record().percent"></span
    ></span>
    <span class="value">{{ text() }}</span>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-variant-numeric: tabular-nums;
    }
    .bar {
      position: relative;
      width: 56px;
      height: 6px;
      overflow: hidden;
      border-radius: 999px;
      background: color-mix(in srgb, var(--foreground) 18%, transparent);
    }
    .fill {
      position: absolute;
      inset: 0 auto 0 0;
      border-radius: inherit;
      background: var(--primary);
    }
    .value {
      font-weight: 600;
    }
  `,
})
export class ForecastConfidenceComponent {
  readonly record = input.required<ForecastRecord>();

  protected readonly text = computed(() => {
    const { percent, called } = this.record();
    return called ? `${percent}% confidence` : `Right ${percent}% when it calls`;
  });
}
