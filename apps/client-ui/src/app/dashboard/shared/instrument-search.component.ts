import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch } from '@ng-icons/lucide';
import { Instrument, searchInstruments } from '../mock-data';
import { SignedPercentPipe } from './signed-percent.pipe';

let nextId = 0;

@Component({
  selector: 'app-instrument-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, CurrencyPipe, SignedPercentPipe],
  providers: [provideIcons({ lucideSearch })],
  host: { class: 'relative block' },
  template: `
    <label [for]="inputId" class="sr-only">Search instruments</label>
    <ng-icon
      name="lucideSearch"
      class="text-muted-foreground pointer-events-none absolute top-1/2 left-4 -translate-y-1/2"
      [class]="size() === 'lg' ? 'text-[24px]' : 'text-[16px]'"
    />
    <input
      [id]="inputId"
      type="search"
      role="combobox"
      autocomplete="off"
      placeholder="Search"
      class="border-border bg-card placeholder:text-muted-foreground focus-visible:border-ring w-full rounded-xl border transition-colors outline-none"
      [class]="size() === 'lg' ? 'h-[70px] pr-4 pl-14 text-2xl' : 'h-11 pr-4 pl-11 text-sm'"
      [value]="query()"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="listId"
      [attr.aria-activedescendant]="open() ? optionId(activeIndex()) : null"
      (input)="onInput($event)"
      (focus)="focused.set(true)"
      (blur)="focused.set(false)"
      (keydown)="onKeydown($event)"
    />

    @if (open()) {
      <ul
        [id]="listId"
        role="listbox"
        class="border-border bg-popover absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-[5px] border py-1 shadow-lg"
      >
        @for (instrument of results(); track instrument.symbol; let i = $index) {
          <li
            [id]="optionId(i)"
            role="option"
            [attr.aria-selected]="i === activeIndex()"
            class="flex cursor-pointer items-center justify-between gap-4 px-4 py-2"
            [class.bg-muted]="i === activeIndex()"
            (mousedown)="$event.preventDefault()"
            (mouseenter)="activeIndex.set(i)"
            (click)="select(instrument)"
          >
            <span class="min-w-0">
              <span class="block font-semibold">{{ instrument.symbol }}</span>
              <span class="text-muted-foreground block truncate text-xs">{{ instrument.name }}</span>
            </span>
            <span class="shrink-0 text-right">
              <span class="block">{{ instrument.price | currency: 'USD' }}</span>
              <span
                class="block text-xs"
                [class]="instrument.changePercent >= 0 ? 'text-gain' : 'text-loss'"
              >
                {{ instrument.changePercent | signedPercent }}
              </span>
            </span>
          </li>
        } @empty {
          <li class="text-muted-foreground px-4 py-2 text-sm">No instruments match "{{ query() }}"</li>
        }
      </ul>
    }
  `,
})
export class InstrumentSearchComponent {
  readonly size = input<'md' | 'lg'>('md');
  readonly instruments = input<readonly Instrument[]>([]);
  readonly selected = output<Instrument>();

  protected readonly query = signal('');
  protected readonly focused = signal(false);
  protected readonly activeIndex = signal(0);

  protected readonly results = computed(() => {
    const instruments = this.instruments();
    return instruments.length
      ? searchInstruments(this.query(), instruments)
      : searchInstruments(this.query());
  });
  protected readonly open = computed(() => this.focused() && this.query().trim().length > 0);

  private readonly _id = nextId++;
  protected readonly inputId = `instrument-search-${this._id}`;
  protected readonly listId = `${this.inputId}-results`;

  protected optionId(index: number): string {
    return `${this.listId}-${index}`;
  }

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(0);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.results().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (count) this.activeIndex.update((i) => (i + 1) % count);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (count) this.activeIndex.update((i) => (i - 1 + count) % count);
        break;
      case 'Enter': {
        const instrument = this.results()[this.activeIndex()];
        if (this.open() && instrument) {
          event.preventDefault();
          this.select(instrument);
        }
        break;
      }
      case 'Escape':
        if (this.query()) {
          // Clear the search without also closing an enclosing dialog.
          event.stopPropagation();
          this.query.set('');
        }
        break;
    }
  }

  protected select(instrument: Instrument): void {
    this.query.set('');
    this.selected.emit(instrument);
  }
}
