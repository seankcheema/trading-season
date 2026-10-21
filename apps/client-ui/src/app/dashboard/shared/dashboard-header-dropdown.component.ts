import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

@Component({
  selector: 'app-dashboard-header-dropdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  template: `
    <details [class]="containerClasses()" [open]="open()" (toggle)="onToggle($event)" (keydown.escape)="onEscape($event)">
      <summary [class]="triggerClasses()" [attr.aria-label]="accessibleName()">
        <ng-content select="[dropdownTrigger]">
          <ng-icon [name]="iconName()" class="shrink-0 text-[16px]" />
          @if (loading()) {
            <span class="skeleton h-4 min-w-0 flex-1" aria-hidden="true"></span>
            <span class="sr-only">{{ label() }}</span>
          } @else {
            <span class="min-w-0 flex-1 truncate text-left leading-tight">{{ label() }}</span>
          }
          <ng-icon name="lucideChevronDown" class="text-muted-foreground shrink-0 text-[14px]" />
        </ng-content>
      </summary>
      <div [class]="panelClasses()">
        <ng-content />
      </div>
    </details>
  `,
  styles: [
    `
      .header-dropdown summary::-webkit-details-marker {
        display: none;
      }

      .header-dropdown[open] summary {
        background: var(--muted);
      }
    `,
  ],
})
export class DashboardHeaderDropdownComponent {
  // Only used by the default trigger; a projected [dropdownTrigger] replaces it.
  readonly iconName = input('');
  readonly label = input('');
  // The label is not known yet: the default trigger shows a placeholder in its place and
  // keeps the label for assistive technology.
  readonly loading = input(false);
  // What the trigger does, such as "Select account".
  readonly ariaLabel = input.required<string>();
  // The text a projected [dropdownTrigger] shows; the default trigger shows `label`.
  readonly triggerText = input('');
  readonly open = input(false);
  readonly containerClass = input('');
  readonly triggerClass = input('');
  readonly panelClass = input('');
  readonly openChange = output<boolean>();

  // The trigger's accessible name starts with the text it shows and goes on to what it does, so
  // a voice control user can say what they see (WCAG 2.5.3): "Brokerage, Select account".
  protected readonly accessibleName = computed(() => {
    const shown = (this.triggerText() || this.label()).trim();
    return shown ? `${shown}, ${this.ariaLabel()}` : this.ariaLabel();
  });

  protected readonly containerClasses = computed(() =>
    ['header-dropdown relative min-w-0 max-w-[calc(100vw-2rem)]', this.containerClass()]
      .filter(Boolean)
      .join(' '),
  );

  // triggerClass replaces the default skin rather than adding to it, so a trigger can pick
  // its own shape without competing with the defaults for Tailwind precedence.
  protected readonly triggerClasses = computed(() =>
    [
      'flex min-w-0 cursor-pointer list-none items-center transition-colors',
      this.triggerClass() ||
        'border-border bg-card hover:bg-muted focus-visible:border-ring h-9 w-full gap-2 rounded-lg border px-3 text-sm',
    ].join(' '),
  );

  protected readonly panelClasses = computed(() =>
    [
      'border-border bg-card absolute top-11 right-0 z-30 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border p-2 shadow-xl',
      this.panelClass(),
    ]
      .filter(Boolean)
      .join(' '),
  );

  protected onEscape(event: KeyboardEvent): void {
    const details = event.currentTarget as HTMLDetailsElement;
    if (!details.open) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    details.open = false;
    this.openChange.emit(false);
    details.querySelector('summary')?.focus();
  }

  protected onToggle(event: Event): void {
    const isOpen = (event.target as HTMLDetailsElement).open;
    if (isOpen !== this.open()) {
      this.openChange.emit(isOpen);
    }
  }
}
