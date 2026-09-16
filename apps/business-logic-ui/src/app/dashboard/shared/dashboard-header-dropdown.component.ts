import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

@Component({
  selector: 'app-dashboard-header-dropdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  template: `
    <details [class]="containerClasses()" [open]="open()" (toggle)="onToggle($event)">
      <summary [class]="triggerClasses()" [attr.aria-label]="ariaLabel()">
        <ng-icon [name]="iconName()" class="shrink-0 text-[16px]" />
        <span class="min-w-0 flex-1 whitespace-nowrap text-left leading-tight">{{ label() }}</span>
        <ng-icon name="lucideChevronDown" class="text-muted-foreground shrink-0 text-[14px]" />
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
  readonly iconName = input.required<string>();
  readonly label = input.required<string>();
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

  protected readonly triggerClasses = computed(() =>
    [
      'border-border bg-card hover:bg-muted focus-visible:border-ring flex h-9 w-full min-w-0 cursor-pointer list-none items-center gap-2 rounded-lg border px-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/35',
      this.triggerClass(),
    ]
      .filter(Boolean)
      .join(' '),
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
