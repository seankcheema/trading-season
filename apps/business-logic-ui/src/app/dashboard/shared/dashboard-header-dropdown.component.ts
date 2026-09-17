import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

@Component({
  selector: 'app-dashboard-header-dropdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  template: `
    <details [class]="containerClasses()" [open]="open()" (toggle)="onToggle($event)">
      <summary [class]="triggerClasses()" [attr.aria-label]="ariaLabel()">
        <ng-content select="[dropdownTrigger]">
          <ng-icon [name]="iconName()" class="shrink-0 text-[16px]" />
          <span class="min-w-0 flex-1 whitespace-nowrap text-left leading-tight">{{ label() }}</span>
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
  readonly ariaLabel = input.required<string>();
  readonly open = input(false);
  readonly containerClass = input('');
  readonly triggerClass = input('');
  readonly panelClass = input('');
  readonly openChange = output<boolean>();

  protected readonly containerClasses = computed(() =>
    ['header-dropdown relative min-w-0 max-w-[calc(100vw-2rem)]', this.containerClass()]
      .filter(Boolean)
      .join(' '),
  );

  // triggerClass replaces the default skin rather than adding to it, so a trigger can pick
  // its own shape without competing with the defaults for Tailwind precedence.
  protected readonly triggerClasses = computed(() =>
    [
      'flex min-w-0 cursor-pointer list-none items-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/35',
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

  protected onToggle(event: Event): void {
    const isOpen = (event.target as HTMLDetailsElement).open;
    if (isOpen !== this.open()) {
      this.openChange.emit(isOpen);
    }
  }
}
