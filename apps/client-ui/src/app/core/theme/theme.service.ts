import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

// index.html reads the same key before the app starts; keep the two in step.
export const THEME_STORAGE_KEY = 'ts.settings.theme';

// The class on <html> that selects the dark tokens in styles.css.
const DARK_CLASS = 'dark';

// The class on <html> that holds every transition still while the theme changes.
const SWITCHING_CLASS = 'theme-switching';

// The color theme of this browser: dark, the design system's, unless light was chosen.
// The class on <html> is the source of truth at start-up, because the script in
// index.html has already applied the saved choice by then. A choice is saved for this
// browser and followed by its other open tabs.
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _root = inject(DOCUMENT).documentElement;
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _theme = signal<Theme>(
    this._root.classList.contains(DARK_CLASS) ? 'dark' : 'light',
  );
  readonly theme = this._theme.asReadonly();

  constructor() {
    if (!this._isBrowser) {
      return;
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        this.apply(event.newValue === 'light' ? 'light' : 'dark');
      }
    };
    window.addEventListener('storage', onStorage);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('storage', onStorage));
  }

  setTheme(theme: Theme): void {
    this.apply(theme);
    if (!this._isBrowser) {
      return;
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // The theme still applies until the page is reloaded.
    }
  }

  toggle(): void {
    this.setTheme(this._theme() === 'dark' ? 'light' : 'dark');
  }

  private apply(theme: Theme): void {
    this._theme.set(theme);
    if (!this._isBrowser) {
      this._root.classList.toggle(DARK_CLASS, theme === 'dark');
      return;
    }
    // Every color changes at once: with transitions on, each control would fade from the
    // old theme at its own speed. Reading a computed style commits the new colors before
    // transitions come back.
    this._root.classList.add(SWITCHING_CLASS);
    this._root.classList.toggle(DARK_CLASS, theme === 'dark');
    void getComputedStyle(this._root).color;
    this._root.classList.remove(SWITCHING_CLASS);
  }
}
