import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

@Component({
  selector: 'app-dashboard-header-dropdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  template: `
    <details [class]="containerClasses()">
      <summary [class]="triggerClasses()" [attr.aria-label]="ariaLabel()">
        <ng-icon [name]="iconName()" class="shrink-0 text-[16px]" />
        <span class="min-w-0 flex-1 truncate text-left">{{ label() }}</span>
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
  readonly containerClass = input('');
  readonly triggerClass = input('');
  readonly panelClass = input('');

  protected readonly containerClasses = computed(() =>
    ['header-dropdown relative min-w-0', this.containerClass()].filter(Boolean).join(' '),
  );

  protected readonly triggerClasses = computed(() =>
    [
      'border-border bg-card hover:bg-muted focus-visible:border-ring flex h-9 min-w-0 cursor-pointer list-none items-center gap-2 rounded-lg border px-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/35',
      this.triggerClass(),
    ]
      .filter(Boolean)
      .join(' '),
  );

  protected readonly panelClasses = computed(() =>
    [
      'border-border bg-card absolute top-11 right-0 z-30 rounded-xl border p-2 shadow-xl',
      this.panelClass(),
    ]
      .filter(Boolean)
      .join(' '),
  );
}
