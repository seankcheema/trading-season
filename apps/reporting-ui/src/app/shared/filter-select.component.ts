import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideChevronDown } from '@ng-icons/lucide';

export interface SelectOption {
  value: string;
  label: string;
}

let nextSelectId = 0;

// A filter in a table's filter row: a small uppercase caption over a select whose
// list pops open below it, with a check on the chosen option.
@Component({
  selector: 'app-filter-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  providers: [provideIcons({ lucideCheck, lucideChevronDown })],
  host: {
    class: 'flex flex-col gap-1',
    '(document:mousedown)': 'closeIfOutside($event)',
    '(keydown.escape)': 'open.set(false)',
  },
  template: `
    <span class="dash-label text-[11px]" [id]="id + '-label'">{{ label() }}</span>
    <div class="relative" [style.width.px]="width()">
      <button
        type="button"
        class="ds-control flex cursor-pointer items-center justify-between gap-1.5 pr-2 pl-2.5 whitespace-nowrap"
        aria-haspopup="listbox"
        [attr.aria-expanded]="open()"
        [attr.aria-labelledby]="id + '-label ' + id + '-value'"
        (click)="open.set(!open())"
      >
        <span class="truncate" [id]="id + '-value'">{{ current().label }}</span>
        <ng-icon name="lucideChevronDown" size="16" class="text-muted-foreground shrink-0" />
      </button>
      @if (open()) {
        <div
          role="listbox"
          class="bg-popover text-popover-foreground ring-foreground/10 absolute top-[calc(100%+4px)] left-0 z-40 max-h-72 min-w-full animate-[ts-pop-in_100ms_ease-out] overflow-y-auto rounded-lg p-1 shadow-md ring-1"
          [attr.aria-labelledby]="id + '-label'"
        >
          @for (option of normalized(); track option.value) {
            <button
              type="button"
              role="option"
              class="hover:bg-accent focus-visible:bg-accent relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-left text-sm whitespace-nowrap"
              [attr.aria-selected]="option.value === value()"
              (click)="choose(option.value)"
            >
              {{ option.label }}
              @if (option.value === value()) {
                <ng-icon name="lucideCheck" size="16" class="absolute right-2" />
              }
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class FilterSelectComponent {
  private readonly _host: ElementRef<HTMLElement> = inject(ElementRef);

  readonly label = input.required<string>();
  // A bare string is an option whose label is its value.
  readonly options = input.required<readonly (string | SelectOption)[]>();
  readonly value = model.required<string>();
  readonly width = input(150);

  protected readonly id = `filter-select-${nextSelectId++}`;
  protected readonly open = signal(false);

  protected readonly normalized = computed(() =>
    this.options().map((option) =>
      typeof option === 'string' ? { value: option, label: option } : option,
    ),
  );

  protected readonly current = computed(
    () =>
      this.normalized().find((option) => option.value === this.value()) ?? {
        value: this.value(),
        label: this.value(),
      },
  );

  protected choose(value: string): void {
    this.value.set(value);
    this.open.set(false);
  }

  protected closeIfOutside(event: Event): void {
    if (!this._host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }
}
