import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { TIMEFRAMES, Timeframe } from '../mock-data';

@Component({
  selector: 'app-timeframe-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      role="group"
      aria-label="Chart timeframe"
      class="bg-muted flex gap-0.5 rounded-lg p-0.5"
    >
      @for (option of timeframes; track option) {
        <button
          type="button"
          class="cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
          [class]="
            value() === option
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          "
          [attr.aria-pressed]="value() === option"
          (click)="value.set(option)"
        >
          {{ option }}
        </button>
      }
    </div>
  `,
})
export class TimeframeToggleComponent {
  readonly value = model<Timeframe>('1D');

  protected readonly timeframes = TIMEFRAMES;
}
