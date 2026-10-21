import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMoon, lucideSun } from '@ng-icons/lucide';
import { ThemeService } from './theme.service';

// Switches between the light and dark themes. The icon shows the theme a click gives,
// and the label says so for assistive technology.
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
      [class]="buttonClasses()"
      [attr.aria-label]="label()"
      [attr.title]="label()"
      (click)="themeService.toggle()"
    >
      <ng-icon [name]="isDark() ? 'lucideSun' : 'lucideMoon'" class="text-[16px]" />
    </button>
  `,
})
export class ThemeToggleComponent {
  protected readonly themeService = inject(ThemeService);

  // Replaces the default look, so a header can match its neighbouring controls.
  readonly buttonClass = input('');

  protected readonly isDark = computed(() => this.themeService.theme() === 'dark');
  protected readonly label = computed(() =>
    this.isDark() ? 'Switch to light theme' : 'Switch to dark theme',
  );

  protected readonly buttonClasses = computed(() =>
    [
      'flex shrink-0 cursor-pointer items-center justify-center transition-colors',
      this.buttonClass() ||
        'text-muted-foreground hover:bg-muted hover:text-foreground size-9 rounded-full',
    ].join(' '),
  );
}
