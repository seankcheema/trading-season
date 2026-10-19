import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NgIcon } from '@ng-icons/core';
import { THEME_STORAGE_KEY } from './theme.service';
import { ThemeToggleComponent } from './theme-toggle.component';

@Component({
  imports: [ThemeToggleComponent],
  template: `<app-theme-toggle buttonClass="size-8 rounded-lg" />`,
})
class CustomToggleHostComponent {}

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

  function render() {
    const fixture = TestBed.createComponent(ThemeToggleComponent);
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    const icon = () => fixture.debugElement.query(By.directive(NgIcon)).componentInstance.name();
    return { fixture, button, icon };
  }

  it('offers the light theme while the page is dark', () => {
    const { button, icon } = render();

    expect(button.getAttribute('aria-label')).toBe('Switch to light theme');
    expect(button.getAttribute('title')).toBe('Switch to light theme');
    expect(button.type).toBe('button');
    expect(icon()).toBe('lucideSun');
  });

  it('switches to light and back on each click, and remembers the choice', () => {
    const { fixture, button, icon } = render();

    button.click();
    fixture.detectChanges();

    expect(root.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(button.getAttribute('aria-label')).toBe('Switch to dark theme');
    expect(icon()).toBe('lucideMoon');

    button.click();
    fixture.detectChanges();

    expect(root.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(button.getAttribute('aria-label')).toBe('Switch to light theme');
  });

  it('takes the default look unless a header gives its own', () => {
    const { button } = render();
    expect(button.classList).toContain('rounded-full');

    const custom = TestBed.createComponent(CustomToggleHostComponent);
    custom.detectChanges();
    const customButton = (custom.nativeElement as HTMLElement).querySelector('button')!;

    expect(customButton.classList).toContain('size-8');
    expect(customButton.classList).toContain('rounded-lg');
    expect(customButton.classList).not.toContain('rounded-full');
  });
});
