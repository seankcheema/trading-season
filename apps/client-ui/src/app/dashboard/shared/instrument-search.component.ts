import { CurrencyPipe, DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  booleanAttribute,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowRightLeft,
  lucideFlame,
  lucideHistory,
  lucideSearch,
  lucideStar,
} from '@ng-icons/lucide';
import { Instrument, searchInstruments } from '../mock-data';
import { SignedPercentPipe } from './signed-percent.pipe';

let nextId = 0;

// A labelled group of instruments offered before the user has typed anything.
export interface SearchSuggestionGroup {
  label: string;
  // A Lucide icon registered by this component: flame, star or history.
  icon?: 'lucideFlame' | 'lucideStar' | 'lucideHistory';
  items: readonly Instrument[];
}

// Instrument combobox. On top of search it can offer a keyboard shortcut (/ or Ctrl/Cmd+K),
// grouped suggestions while focused and empty, and a trailing action button that opens the
// best match.
@Component({
  selector: 'app-instrument-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, CurrencyPipe, NgTemplateOutlet, SignedPercentPipe],
  providers: [
    provideIcons({ lucideArrowRightLeft, lucideFlame, lucideHistory, lucideSearch, lucideStar }),
  ],
  host: { class: 'relative block', '(document:keydown)': 'onDocumentKeydown($event)' },
  template: `
    <div class="relative">
      <label [for]="inputId" class="sr-only">Search instruments</label>
      <ng-icon
        name="lucideSearch"
        class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 transition-colors"
        [class]="
          (size() === 'lg' ? 'text-[18px] ' : 'text-[16px] ') +
          (focused() && action() ? 'text-primary' : 'text-muted-foreground')
        "
      />
      <input
        #field
        [id]="inputId"
        type="search"
        role="combobox"
        autocomplete="off"
        [placeholder]="placeholder()"
        [class]="inputClasses()"
        [value]="query()"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="listId"
        [attr.aria-activedescendant]="open() ? optionId(activeIndex()) : null"
        [attr.aria-keyshortcuts]="shortcut() ? '/ Control+K Meta+K' : null"
        (input)="onInput($event)"
        (focus)="onFocus()"
        (blur)="focused.set(false)"
        (keydown)="onKeydown($event)"
      />
      @if (showHint() || action()) {
        <div
          class="absolute top-1/2 flex -translate-y-1/2 items-center gap-2.5"
          [class]="size() === 'lg' ? 'right-1.5' : 'right-[5px]'"
        >
          @if (showHint()) {
            <span
              class="pointer-events-none flex gap-1"
              aria-hidden="true"
              data-testid="search-hint"
            >
              <kbd [class]="kbdClasses">{{ modifierKey }}</kbd>
              <kbd [class]="kbdClasses">K</kbd>
            </span>
          }
          @if (action(); as label) {
            <button
              type="button"
              class="bg-primary text-primary-foreground hover:bg-primary/80 inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition-colors active:translate-y-px"
              [class]="size() === 'lg' ? 'h-9' : 'h-[34px]'"
              data-testid="search-action"
              (mousedown)="$event.preventDefault()"
              (click)="onAction()"
            >
              <ng-icon name="lucideArrowRightLeft" class="text-[14px]" />
              {{ label }}
            </button>
          }
        </div>
      }
    </div>

    @if (open()) {
      <ul [id]="listId" role="listbox" [class]="resultsClasses()">
        @if (hasQuery()) {
          @for (instrument of results(); track instrument.symbol; let i = $index) {
            <ng-container
              [ngTemplateOutlet]="optionRow"
              [ngTemplateOutletContext]="{ $implicit: instrument, index: i }"
            />
          } @empty {
            <li class="text-muted-foreground px-4 py-2 text-sm">
              No instruments match "{{ query() }}"
            </li>
          }
        } @else {
          @for (group of suggestionGroups(); track group.label; let g = $index) {
            <li
              role="presentation"
              [class]="g ? 'border-border/60 mt-1 border-t pt-1' : ''"
              [attr.data-testid]="'search-suggestions-' + group.label"
            >
              <div
                class="text-muted-foreground flex items-center gap-1.5 px-4 pt-1.5 pb-1 text-[11px] font-medium tracking-[0.04em] uppercase"
              >
                @if (group.icon) {
                  <ng-icon [name]="group.icon" class="text-[12px]" />
                }
                {{ group.label }}
              </div>
              <ul role="group" [attr.aria-label]="group.label">
                @for (instrument of group.items; track instrument.symbol; let i = $index) {
                  <ng-container
                    [ngTemplateOutlet]="optionRow"
                    [ngTemplateOutletContext]="{
                      $implicit: instrument,
                      index: groupOffset(g) + i,
                    }"
                  />
                }
              </ul>
            </li>
          }
        }
      </ul>
    }

    <ng-template #optionRow let-instrument let-index="index">
      <li
        [id]="optionId(index)"
        role="option"
        [attr.aria-selected]="index === activeIndex()"
        class="flex cursor-pointer items-center justify-between gap-4 px-4 py-2"
        [class.bg-muted]="index === activeIndex()"
        (mousedown)="$event.preventDefault()"
        (mouseenter)="activeIndex.set(index)"
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
    </ng-template>
  `,
})
export class InstrumentSearchComponent {
  private readonly document = inject(DOCUMENT);
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  readonly size = input<'md' | 'lg'>('md');
  readonly placeholder = input('Search');
  readonly embedded = input(false, { transform: booleanAttribute });
  readonly instruments = input<readonly Instrument[]>([]);
  // Focus the search with / or Ctrl/Cmd+K, and show the Ctrl/Cmd+K hint while idle.
  readonly shortcut = input(false, { transform: booleanAttribute });
  // Groups offered when the input is focused and empty. Empty groups are hidden.
  readonly suggestions = input<readonly SearchSuggestionGroup[]>([]);
  // Label of a trailing button that opens the best match, or focuses the search when empty.
  readonly action = input<string | null>(null);
  readonly selected = output<Instrument>();

  protected readonly query = signal('');
  protected readonly focused = signal(false);
  protected readonly activeIndex = signal(0);

  protected readonly modifierKey = isApplePlatform() ? '⌘' : 'Ctrl';
  protected readonly kbdClasses =
    'border-border bg-muted text-muted-foreground inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border px-1.5 text-[11px] leading-none font-medium';

  protected readonly results = computed(() => {
    const instruments = this.instruments();
    return instruments.length
      ? searchInstruments(this.query(), instruments)
      : searchInstruments(this.query());
  });
  protected readonly hasQuery = computed(() => this.query().trim().length > 0);
  protected readonly suggestionGroups = computed(() =>
    this.suggestions().filter((group) => group.items.length > 0),
  );
  // Every option on screen in order, which is what the arrow keys and the active id walk.
  private readonly options = computed<readonly Instrument[]>(() =>
    this.hasQuery() ? this.results() : this.suggestionGroups().flatMap((group) => group.items),
  );
  protected readonly open = computed(
    () => this.focused() && (this.hasQuery() || this.suggestionGroups().length > 0),
  );
  protected readonly showHint = computed(() => this.shortcut() && !this.focused() && !this.query());
  protected readonly inputClasses = computed(() => {
    const right = this.action()
      ? this.showHint()
        ? 'pr-40'
        : 'pr-24'
      : this.showHint()
        ? 'pr-20'
        : 'pr-4';
    const size =
      this.size() === 'lg' ? `h-12 ${right} pl-12 text-base` : `h-11 ${right} pl-11 text-sm`;
    const base =
      'border-border placeholder:text-muted-foreground focus-visible:border-ring w-full border transition-colors outline-none';
    const ring = this.action() ? ' focus-visible:ring-ring/50 focus-visible:ring-3' : '';
    return this.embedded()
      ? `${base} ${size} rounded-none border-x-0 border-t-0 bg-transparent`
      : `${base} ${size} bg-card rounded-xl${ring}`;
  });
  protected readonly resultsClasses = computed(() =>
    this.embedded()
      ? 'max-h-64 overflow-y-auto py-1'
      : 'border-border bg-popover absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-[5px] border py-1 shadow-lg',
  );

  private readonly _id = nextId++;
  protected readonly inputId = `instrument-search-${this._id}`;
  protected readonly listId = `${this.inputId}-results`;

  protected optionId(index: number): string {
    return `${this.listId}-${index}`;
  }

  // Where a suggestion group's options start in the flat list.
  protected groupOffset(group: number): number {
    return this.suggestionGroups()
      .slice(0, group)
      .reduce((total, previous) => total + previous.items.length, 0);
  }

  protected onFocus(): void {
    this.focused.set(true);
    this.activeIndex.set(0);
  }

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(0);
  }

  // A modal dialog owns the keyboard while it is open, and typing in a field must keep its
  // slash, so the shortcut only fires from the page itself.
  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.shortcut() || this.document.querySelector('[aria-modal="true"]')) return;
    const target = event.target;
    const typing =
      target instanceof HTMLElement &&
      (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
    const palette = event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey);
    const slash = event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey;
    if (palette || slash) {
      event.preventDefault();
      this.field().nativeElement.focus();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.options().length;
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
        const instrument = this.options()[this.activeIndex()];
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
        } else {
          this.field().nativeElement.blur();
        }
        break;
    }
  }

  protected onAction(): void {
    const best = this.hasQuery() ? this.results()[0] : undefined;
    if (best) this.select(best);
    else this.field().nativeElement.focus();
  }

  protected select(instrument: Instrument): void {
    this.query.set('');
    // Otherwise the suggestions would reopen straight away behind the order ticket.
    if (this.suggestionGroups().length) this.field().nativeElement.blur();
    this.selected.emit(instrument);
  }
}

function isApplePlatform(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
}
