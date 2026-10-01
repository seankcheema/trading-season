import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  HlmButton,
  HlmButtonImports,
  injectBrnButtonConfig,
  provideBrnButtonConfig,
} from '@shared/ui-components/button';

@Component({
  standalone: true,
  imports: [HlmButtonImports],
  template: `<button hlmBtn>Click</button>`,
})
class DefaultButtonHost {}

@Component({
  standalone: true,
  imports: [HlmButtonImports],
  template: `<button hlmBtn [variant]="variant()" [size]="size()">Click</button>`,
})
class CustomButtonHost {
  variant = signal<'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link'>(
    'default',
  );
  size = signal<'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg'>(
    'default',
  );
}

@Component({
  standalone: true,
  imports: [HlmButtonImports],
  providers: [provideBrnButtonConfig({ variant: 'secondary', size: 'sm' })],
  template: `<button hlmBtn>Click</button>`,
})
class ConfiguredButtonHost {}

describe('HlmButton', () => {
  it('applies default variant and size classes', () => {
    const fixture = TestBed.createComponent(DefaultButtonHost);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button');

    expect(button.getAttribute('data-slot')).toBe('button');
    expect(button.className).toContain('bg-primary');
    expect(button.className).toContain('h-8');
  });

  it('falls back to the default config when none is provided', () => {
    const fixture = TestBed.createComponent(DefaultButtonHost);
    fixture.detectChanges();
    const directive = fixture.debugElement.query(By.directive(HlmButton)).injector.get(HlmButton);

    expect(directive.variant()).toBe('default');
    expect(directive.size()).toBe('default');
  });

  it('applies a custom variant and size', () => {
    const fixture = TestBed.createComponent(CustomButtonHost);
    fixture.detectChanges();

    fixture.componentInstance.variant.set('destructive');
    fixture.componentInstance.size.set('lg');
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button');

    expect(button.className).toContain('text-destructive');
    expect(button.className).toContain('h-9');
  });

  it('merges classes set imperatively via setClass', () => {
    const fixture = TestBed.createComponent(DefaultButtonHost);
    fixture.detectChanges();
    const debugEl = fixture.debugElement.query(By.directive(HlmButton));
    const directive = debugEl.injector.get(HlmButton);

    directive.setClass('my-extra-class');
    fixture.detectChanges();

    expect(debugEl.nativeElement.className).toContain('my-extra-class');
  });

  it('uses a provided BrnButtonConfig for default variant and size', () => {
    const fixture = TestBed.createComponent(ConfiguredButtonHost);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button');

    expect(button.className).toContain('bg-secondary');
    expect(button.className).toContain('h-7');
  });

  it('injects the default config outside an injection context override', () => {
    TestBed.runInInjectionContext(() => {
      expect(injectBrnButtonConfig()).toEqual({ variant: 'default', size: 'default' });
    });
  });
});
