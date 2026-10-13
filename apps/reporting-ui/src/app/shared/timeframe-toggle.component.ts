import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface ToggleOption<T extends string> {
  value: T;
  label: string;
}

// A segmented control for the range a screen covers. The active segment is cyan.
@Component({
  selector: 'app-timeframe-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'group',
    class: 'bg-muted flex w-fit gap-0.5 rounded-lg p-0.5',
    '[attr.aria-label]': 'label()',
  },
  template: `
    @for (option of options(); track option.value) {
      <button
        type="button"
        class="cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
        [class]="
          option.value === value()
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        "
        [attr.aria-pressed]="option.value === value()"
        (click)="value.set(option.value)"
      >
        {{ option.label }}
      </button>
    }
  `,
})
export class TimeframeToggleComponent<T extends string> {
  readonly options = input.required<readonly ToggleOption<T>[]>();
  readonly value = model.required<T>();
  readonly label = input('Range');
}
