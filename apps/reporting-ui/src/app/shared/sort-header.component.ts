import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideChevronUp, lucideChevronsUpDown } from '@ng-icons/lucide';
import { SortDirection } from '../reporting/report-summary';

// A table column heading that toggles sorting: first click sorts descending, then it flips.
@Component({
  selector: 'button[app-sort-header]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  providers: [provideIcons({ lucideChevronDown, lucideChevronUp, lucideChevronsUpDown })],
  host: {
    type: 'button',
    class:
      'hover:text-foreground flex min-w-0 cursor-pointer items-center gap-1 uppercase transition-colors',
    '[class]': "align() === 'right' ? 'justify-end' : 'justify-start'",
    '[class.text-foreground]': 'active()',
    '[attr.aria-label]': "'Sort by ' + label()",
    '[attr.data-sort]': 'active() ? direction() : null',
    '(click)': 'toggled.emit()',
  },
  template: `
    <span class="truncate">{{ label() }}</span>
    <ng-icon
      class="shrink-0"
      [class]="active() ? 'text-primary' : 'opacity-60'"
      [name]="
        active()
          ? direction() === 'asc'
            ? 'lucideChevronUp'
            : 'lucideChevronDown'
          : 'lucideChevronsUpDown'
      "
      size="12"
    />
  `,
})
export class SortHeaderComponent {
  readonly label = input.required<string>();
  readonly active = input(false);
  readonly direction = input<SortDirection>('desc');
  readonly align = input<'left' | 'right'>('left');
  readonly toggled = output<void>();
}
