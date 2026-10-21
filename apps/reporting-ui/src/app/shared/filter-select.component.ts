import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideChevronDown } from '@ng-icons/lucide';
import { matchesFocusVisible } from './export-menu.component';

export interface SelectOption {
  value: string;
  label: string;
}

let nextSelectId = 0;

// A filter in a table's filter row: a small uppercase caption over a select whose
// list pops open below it, with a check on the chosen option. From the keyboard the
// list opens on the chosen option, the arrow keys, Home and End move between
// options, Enter or Space picks one, and Escape or Tab closes the list, leaving focus
// on the button.
@Component({
  selector: 'app-filter-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  providers: [provideIcons({ lucideCheck, lucideChevronDown })],
  host: {
    class: 'flex flex-col gap-1',
    '(document:mousedown)': 'closeIfOutside($event)',
    '(keydown.escape)': 'close()',
    '(focusout)': 'closeIfFocusLeaves($event)',
  },
  template: `
    <span class="dash-label text-[11px]" [id]="id + '-label'">{{ label() }}</span>
    <div class="relative" [style.width.px]="width()">
      <button
        #trigger
        type="button"
        class="ds-control flex cursor-pointer items-center justify-between gap-1.5 pr-2 pl-2.5 whitespace-nowrap"
        aria-haspopup="listbox"
        [attr.aria-expanded]="open()"
        [attr.aria-labelledby]="id + '-label ' + id + '-value'"
        (click)="toggle()"
        (keydown.arrowdown)="$event.preventDefault(); openOnChosen()"
        (keydown.arrowup)="$event.preventDefault(); openOnChosen()"
      >
        <span class="truncate" [id]="id + '-value'">{{ current().label }}</span>
        <ng-icon name="lucideChevronDown" size="16" class="text-muted-foreground shrink-0" />
      </button>
      @if (open()) {
        <div
          #list
          role="listbox"
          class="bg-popover text-popover-foreground ring-foreground/10 absolute top-[calc(100%+4px)] left-0 z-40 max-h-72 min-w-full animate-[ts-pop-in_100ms_ease-out] overflow-y-auto rounded-lg p-1 shadow-md ring-1"
          [attr.aria-labelledby]="id + '-label'"
          (keydown)="moveFocus($event)"
        >
          @for (option of normalized(); track option.value) {
            <button
              type="button"
              role="option"
              tabindex="-1"
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
  private readonly _injector = inject(Injector);
  private readonly _trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly _list = viewChild<ElementRef<HTMLElement>>('list');

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

  protected toggle(): void {
    if (this.open()) {
      this.open.set(false);
    } else if (matchesFocusVisible(this._trigger().nativeElement)) {
      this.openOnChosen();
    } else {
      this.open.set(true);
    }
  }

  protected openOnChosen(): void {
    this.open.set(true);
    afterNextRender(
      () => {
        const options = this.optionButtons();
        (options.find((option) => option.getAttribute('aria-selected') === 'true') ?? options[0])
          ?.focus();
      },
      { injector: this._injector },
    );
  }

  protected close(): void {
    if (this.open()) {
      this.open.set(false);
      this._trigger().nativeElement.focus();
    }
  }

  protected moveFocus(event: KeyboardEvent): void {
    const options = this.optionButtons();
    const current = options.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === 'ArrowDown'
        ? Math.min(current + 1, options.length - 1)
        : event.key === 'ArrowUp'
          ? Math.max(current - 1, 0)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? options.length - 1
              : null;
    if (next !== null) {
      event.preventDefault();
      options[next]?.focus();
    }
  }

  protected choose(value: string): void {
    this.value.set(value);
    this.open.set(false);
    this._trigger().nativeElement.focus();
  }

  protected closeIfFocusLeaves(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next && !this._host.nativeElement.contains(next)) {
      this.open.set(false);
    }
  }

  private optionButtons(): HTMLElement[] {
    return [...(this._list()?.nativeElement.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
  }

  protected closeIfOutside(event: Event): void {
    if (!this._host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }
}
