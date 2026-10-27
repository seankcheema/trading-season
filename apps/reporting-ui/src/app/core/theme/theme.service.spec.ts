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

  const otherTabSaves = (key: string, newValue: string | null) =>
    window.dispatchEvent(new StorageEvent('storage', { key, newValue }));

  it('starts in the theme the page opened in', () => {
    expect(TestBed.inject(ThemeService).theme()).toBe('dark');

    TestBed.resetTestingModule();
    root.classList.remove('dark');

    expect(TestBed.inject(ThemeService).theme()).toBe('light');
  });

  it('toggles the theme on screen and saves it for this browser', () => {
    const service = TestBed.inject(ThemeService);

    service.toggle();

    expect(service.theme()).toBe('light');
    expect(root.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    service.toggle();

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

    TestBed.inject(ThemeService).toggle();

    expect(held).toEqual([true]);
    expect(root.classList.contains('theme-switching')).toBe(false);
  });

  it('still toggles when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const service = TestBed.inject(ThemeService);

    service.toggle();

    expect(service.theme()).toBe('light');
    expect(root.classList.contains('dark')).toBe(false);
  });

  it('follows the theme chosen in another tab, and only that key', () => {
    const service = TestBed.inject(ThemeService);

    otherTabSaves('ts.reporting.sidebar-collapsed', 'light');
    expect(service.theme()).toBe('dark');

    otherTabSaves(THEME_STORAGE_KEY, 'light');
    expect(service.theme()).toBe('light');
    expect(root.classList.contains('dark')).toBe(false);

    otherTabSaves(THEME_STORAGE_KEY, null);
    expect(service.theme()).toBe('dark');
  });

  it('stops following other tabs once destroyed', () => {
    const service = TestBed.inject(ThemeService);

    TestBed.resetTestingModule();
    otherTabSaves(THEME_STORAGE_KEY, 'light');

    expect(service.theme()).toBe('dark');
    expect(root.classList.contains('dark')).toBe(true);
  });
});
