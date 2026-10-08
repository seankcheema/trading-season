import { ChangeDetectionStrategy, Component, input } from '@angular/core';

// Title row of a reporting screen: title, a quiet line of metadata, and actions on the right.
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3' },
  template: `
    <div class="min-w-0">
      <h1 class="text-xl font-semibold tracking-tight">{{ title() }}</h1>
      @if (subtitle()) {
        <p class="text-muted-foreground mt-0.5 text-xs">{{ subtitle() }}</p>
      }
    </div>
    <div class="flex items-center gap-2"><ng-content /></div>
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input('');
}
