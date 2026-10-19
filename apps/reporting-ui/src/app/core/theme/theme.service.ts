import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

// index.html reads the same key before the app starts; keep the two in step. The Client UI
// uses the same key on its own origin.
export const THEME_STORAGE_KEY = 'ts.settings.theme';

// The theme on screen: dark, the design system's, unless light was chosen in this browser.
// The class on <html> selects the dark tokens in styles.css, and it is the source of truth at
// start-up because the script in index.html has already applied the saved choice. Other open
// tabs follow a change. Whatever is on screen, a printout and the chart PNGs are light.
// Mirrors the Client UI's ThemeService, without its server rendering branch.
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _root = inject(DOCUMENT).documentElement;
  private readonly _theme = signal<Theme>(this._root.classList.contains('dark') ? 'dark' : 'light');
  readonly theme = this._theme.asReadonly();

  constructor() {
    const onStorage = ({ key, newValue }: StorageEvent) => {
      if (key === THEME_STORAGE_KEY) {
        this.apply(newValue === 'light' ? 'light' : 'dark');
      }
    };
    window.addEventListener('storage', onStorage);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('storage', onStorage));
  }

  toggle(): void {
    const theme = this._theme() === 'dark' ? 'light' : 'dark';
    this.apply(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // The theme still applies until the page is reloaded.
    }
  }

  // Every color changes at once: transitions are held still while the class flips, and
  // reading a computed style commits the new colors before they come back.
  private apply(theme: Theme): void {
    this._theme.set(theme);
    this._root.classList.add('theme-switching');
    this._root.classList.toggle('dark', theme === 'dark');
    void getComputedStyle(this._root).color;
    this._root.classList.remove('theme-switching');
  }
}
