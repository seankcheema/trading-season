import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideDownload,
  lucideFileSpreadsheet,
  lucideFileText,
} from '@ng-icons/lucide';

// Quotes every cell, so commas, quotes and line breaks in a value survive.
export function toCsv(header: readonly string[], rows: readonly (readonly unknown[])[]): string {
  const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [header, ...rows].map((row) => row.map(cell).join(',')).join('\n');
}

// Hands the browser a file to save under the given name.
export function saveFile(name: string, file: Blob): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Hands the browser a CSV file to save.
export function downloadCsv(
  name: string,
  header: readonly string[],
  rows: readonly (readonly unknown[])[],
): void {
  saveFile(`${name}.csv`, new Blob([toCsv(header, rows)], { type: 'text/csv' }));
}

// The Export control of a page header: the rows on screen as CSV, or the screen
// itself as a PDF through the browser's print dialog. It follows the menu button
// pattern: opened from the keyboard it starts on its first item, the arrow keys,
// Home and End move between items, and Escape closes it back onto the button.
@Component({
  selector: 'app-export-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  providers: [
    provideIcons({ lucideChevronDown, lucideDownload, lucideFileSpreadsheet, lucideFileText }),
  ],
  host: {
    class: 'relative block w-[116px] shrink-0',
    'data-print-hide': 'true',
    '(document:mousedown)': 'closeIfOutside($event)',
    '(keydown.escape)': 'close()',
  },
  template: `
    <button
      #trigger
      type="button"
      class="bg-card hover:bg-muted flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm transition-colors"
      [class.bg-muted]="open()"
      aria-label="Export this view"
      aria-haspopup="menu"
      [attr.aria-expanded]="open()"
      (click)="toggle()"
      (keydown.arrowdown)="$event.preventDefault(); openAt(0)"
      (keydown.arrowup)="$event.preventDefault(); openAt(-1)"
    >
      <ng-icon name="lucideDownload" size="16" />
      <span class="min-w-0 flex-1 truncate text-left leading-tight">Export</span>
      <ng-icon name="lucideChevronDown" size="14" class="text-muted-foreground" />
    </button>
    @if (open()) {
      <div
        #menu
        role="menu"
        aria-label="Export"
        class="bg-card absolute top-11 right-0 z-30 w-44 overflow-hidden rounded-xl border p-1 shadow-xl"
        (keydown)="moveFocus($event)"
      >
        @if (csv()) {
          <button type="button" role="menuitem" [class]="item" (click)="choose('csv')">
            <ng-icon name="lucideFileSpreadsheet" size="16" />
            <span class="min-w-0 flex-1">Export CSV</span>
          </button>
        }
        <button type="button" role="menuitem" [class]="item" (click)="choose('pdf')">
          <ng-icon name="lucideFileText" size="16" />
          <span class="min-w-0 flex-1">Export PDF</span>
        </button>
      </div>
    }
  `,
})
export class ExportMenuComponent {
  private readonly _host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly _injector = inject(Injector);
  private readonly _trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly _menu = viewChild<ElementRef<HTMLElement>>('menu');

  // Whether this screen has rows to offer as CSV.
  readonly csv = input(true);
  // Asks the screen for its CSV; the screen knows its filters and sort.
  readonly exportCsv = output<void>();

  protected readonly open = signal(false);
  protected readonly item =
    'hover:bg-muted flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors';

  protected toggle(): void {
    if (this.open()) {
      this.open.set(false);
      return;
    }
    // A keyboard press lands on the first item; a click leaves focus on the button.
    if (matchesFocusVisible(this._trigger().nativeElement)) {
      this.openAt(0);
    } else {
      this.open.set(true);
    }
  }

  // Opens the menu on an item; -1 is the last.
  protected openAt(index: number): void {
    this.open.set(true);
    afterNextRender(() => this.items().at(index)?.focus(), { injector: this._injector });
  }

  protected close(): void {
    if (this.open()) {
      this.open.set(false);
      this._trigger().nativeElement.focus();
    }
  }

  protected moveFocus(event: KeyboardEvent): void {
    const items = this.items();
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === 'ArrowDown'
        ? (current + 1) % items.length
        : event.key === 'ArrowUp'
          ? (current - 1 + items.length) % items.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.length - 1
              : null;
    if (next !== null) {
      event.preventDefault();
      items[next]?.focus();
    }
  }

  private items(): HTMLElement[] {
    return [
      ...(this._menu()?.nativeElement.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
    ];
  }

  protected choose(format: 'csv' | 'pdf'): void {
    this.open.set(false);
    this._trigger().nativeElement.focus();
    if (format === 'csv') {
      this.exportCsv.emit();
    } else {
      // After the menu has left the page, so it is not in the printout.
      setTimeout(() => window.print(), 50);
    }
  }

  protected closeIfOutside(event: Event): void {
    if (!this._host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }
}

// Whether the element's focus came from the keyboard. Browsers without the selector say no.
export function matchesFocusVisible(element: Element): boolean {
  try {
    return element.matches(':focus-visible');
  } catch {
    return false;
  }
}
