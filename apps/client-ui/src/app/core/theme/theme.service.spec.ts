import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

describe('ThemeService', () => {
  const root = document.documentElement;

  beforeEach(() => {
    localStorage.clear();
    // index.html ships the dark class; its script removes it when light was saved.
    root.classList.add('dark');
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    root.classList.add('dark');
  });

  function otherTabSaves(key: string, newValue: string | null): void {
    window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
  }

  it('starts dark when the page is dark', () => {
    expect(TestBed.inject(ThemeService).theme()).toBe('dark');
  });

  it('starts light when the start-up script has already applied a saved light theme', () => {
    root.classList.remove('dark');

    expect(TestBed.inject(ThemeService).theme()).toBe('light');
  });

  it('applies and saves a chosen theme', () => {
    const service = TestBed.inject(ThemeService);

    service.setTheme('light');

    expect(service.theme()).toBe('light');
    expect(root.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    service.setTheme('dark');

    expect(service.theme()).toBe('dark');
    expect(root.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('holds transitions still while the colors change, and releases them after', () => {
    const held: boolean[] = [];
    const computed = window.getComputedStyle;
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      held.push(root.classList.contains('theme-switching'));
      return computed(element);
    });

    TestBed.inject(ThemeService).setTheme('light');

    expect(held).toEqual([true]);
    expect(root.classList.contains('theme-switching')).toBe(false);
  });

  it('toggles between the two themes', () => {
    const service = TestBed.inject(ThemeService);

    service.toggle();
    expect(service.theme()).toBe('light');

    service.toggle();
    expect(service.theme()).toBe('dark');
  });

  it('still applies a theme when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const service = TestBed.inject(ThemeService);

    service.setTheme('light');

    expect(service.theme()).toBe('light');
    expect(root.classList.contains('dark')).toBe(false);
  });

  it('follows a theme chosen in another tab', () => {
    const service = TestBed.inject(ThemeService);

    otherTabSaves(THEME_STORAGE_KEY, 'light');
    expect(service.theme()).toBe('light');
    expect(root.classList.contains('dark')).toBe(false);

    // A cleared choice falls back to the default.
    otherTabSaves(THEME_STORAGE_KEY, null);
    expect(service.theme()).toBe('dark');
    expect(root.classList.contains('dark')).toBe(true);
  });

  it('ignores other keys changing in another tab', () => {
    const service = TestBed.inject(ThemeService);

    otherTabSaves('ts.settings.idleTimeoutMinutes', 'light');

    expect(service.theme()).toBe('dark');
  });

  it('stops following other tabs once destroyed', () => {
    const service = TestBed.inject(ThemeService);

    TestBed.resetTestingModule();
    otherTabSaves(THEME_STORAGE_KEY, 'light');

    expect(service.theme()).toBe('dark');
    expect(root.classList.contains('dark')).toBe(true);
  });

  describe('on the server', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    });

    it('applies a theme without touching storage or listening to other tabs', () => {
      const setItem = vi.spyOn(Storage.prototype, 'setItem');
      const service = TestBed.inject(ThemeService);

      service.setTheme('light');
      otherTabSaves(THEME_STORAGE_KEY, 'dark');

      expect(service.theme()).toBe('light');
      expect(setItem).not.toHaveBeenCalled();
    });
  });
});
