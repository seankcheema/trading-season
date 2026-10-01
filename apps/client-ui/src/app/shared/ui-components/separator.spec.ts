import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HlmSeparatorImports } from '@shared/ui-components/separator';

@Component({
  standalone: true,
  imports: [HlmSeparatorImports],
  template: `<div hlmSeparator [orientation]="orientation()" [decorative]="decorative()"></div>`,
})
class SeparatorHost {
  orientation = signal<'horizontal' | 'vertical'>('horizontal');
  decorative = signal(true);
}

describe('HlmSeparator', () => {
  function setup() {
    const fixture = TestBed.createComponent(SeparatorHost);
    fixture.detectChanges();
    return fixture;
  }

  it('renders as a decorative horizontal separator by default', () => {
    const fixture = setup();
    const el = fixture.nativeElement.querySelector('[hlmSeparator]') as HTMLElement;

    expect(el.getAttribute('data-slot')).toBe('separator');
    expect(el.getAttribute('data-orientation')).toBe('horizontal');
    expect(el.getAttribute('role')).toBe('none');
    expect(el.className).toContain('data-horizontal:h-px');
  });

  it('renders a vertical, non-decorative separator with the separator role', () => {
    const fixture = setup();

    fixture.componentInstance.orientation.set('vertical');
    fixture.componentInstance.decorative.set(false);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('[hlmSeparator]') as HTMLElement;

    expect(el.getAttribute('data-orientation')).toBe('vertical');
    expect(el.getAttribute('role')).toBe('separator');
    expect(el.getAttribute('aria-orientation')).toBe('vertical');
  });
});
