import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMoon, lucideSun } from '@ng-icons/lucide';
import { ThemeService } from './theme.service';

// Switches the screen between the light and dark themes. The icon shows the theme a click
// gives, and the label says so. Sized to sit beside Log out in the sidebar.
@Component({
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  providers: [provideIcons({ lucideMoon, lucideSun })],
  host: { class: 'contents' },
  template: `
    <button
      type="button"
      data-testid="theme-toggle"
      class="text-muted-foreground hover:bg-muted/50 hover:text-foreground flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors"
      [attr.aria-label]="label()"
      [attr.title]="label()"
      (click)="theme.toggle()"
    >
      <ng-icon [name]="dark() ? 'lucideSun' : 'lucideMoon'" size="16" />
    </button>
  `,
})
export class ThemeToggleComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly dark = computed(() => this.theme.theme() === 'dark');
  protected readonly label = computed(() =>
    this.dark() ? 'Switch to light theme' : 'Switch to dark theme',
  );
}
