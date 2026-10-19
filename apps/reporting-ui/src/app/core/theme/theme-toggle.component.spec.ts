import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NgIcon } from '@ng-icons/core';
import { THEME_STORAGE_KEY } from './theme.service';
import { ThemeToggleComponent } from './theme-toggle.component';

describe('ThemeToggleComponent', () => {
  const root = document.documentElement;

  beforeEach(() => {
    localStorage.clear();
    root.classList.add('dark');
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    root.classList.add('dark');
  });

  it('offers the other theme, switches to it, and remembers it', () => {
    const fixture = TestBed.createComponent(ThemeToggleComponent);
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    const icon = () => fixture.debugElement.query(By.directive(NgIcon)).componentInstance.name();

    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-label')).toBe('Switch to light theme');
    expect(button.getAttribute('title')).toBe('Switch to light theme');
    expect(icon()).toBe('lucideSun');

    button.click();
    fixture.detectChanges();

    expect(root.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(button.getAttribute('aria-label')).toBe('Switch to dark theme');
    expect(icon()).toBe('lucideMoon');

    button.click();
    fixture.detectChanges();

    expect(root.classList.contains('dark')).toBe(true);
    expect(button.getAttribute('aria-label')).toBe('Switch to light theme');
  });
});
