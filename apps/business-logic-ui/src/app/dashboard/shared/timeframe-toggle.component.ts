import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { TIMEFRAMES, Timeframe } from '../mock-data';

@Component({
  selector: 'app-timeframe-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      role="group"
      aria-label="Chart timeframe"
      class="border-border flex overflow-hidden rounded-[5px] border"
    >
      @for (option of timeframes; track option) {
        <button
          type="button"
          class="border-border cursor-pointer px-2 py-1 text-sm transition-colors not-first:border-l"
          [class]="
            value() === option
              ? 'bg-primary text-primary-foreground'
              : 'text-foreground hover:bg-muted'
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
