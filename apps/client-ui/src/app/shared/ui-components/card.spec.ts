import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  HlmCard,
  HlmCardImports,
  injectHlmCardConfig,
  provideHlmCardConfig,
} from '@shared/ui-components/card';

@Component({
  standalone: true,
  imports: [HlmCardImports],
  template: `
    <div hlmCard>
      <div hlmCardHeader>
        <h2 hlmCardTitle>Title</h2>
        <p hlmCardDescription>Description</p>
        <div hlmCardAction>Action</div>
      </div>
      <div hlmCardContent>Content</div>
      <div hlmCardFooter>Footer</div>
    </div>
  `,
})
class DefaultCardHost {}

@Component({
  standalone: true,
  imports: [HlmCardImports],
  template: `<div hlmCard [size]="size()">Content</div>`,
})
class CustomCardHost {
  size = signal<'sm' | 'default'>('default');
}

@Component({
  standalone: true,
  imports: [HlmCardImports],
  providers: [provideHlmCardConfig({ size: 'sm' })],
  template: `<div hlmCard>Content</div>`,
})
class ConfiguredCardHost {}

describe('HlmCard', () => {
  it('renders all card slots with their data-slot attributes', () => {
    const fixture = TestBed.createComponent(DefaultCardHost);
    fixture.detectChanges();
    const root = fixture.nativeElement;

    expect(root.querySelector('[data-slot="card"]')).not.toBeNull();
    expect(root.querySelector('[data-slot="card-header"]')).not.toBeNull();
    expect(root.querySelector('[data-slot="card-title"]')).not.toBeNull();
    expect(root.querySelector('[data-slot="card-description"]')).not.toBeNull();
    expect(root.querySelector('[data-slot="card-action"]')).not.toBeNull();
    expect(root.querySelector('[data-slot="card-content"]')).not.toBeNull();
    expect(root.querySelector('[data-slot="card-footer"]')).not.toBeNull();
  });

  it('defaults to the default size', () => {
    const fixture = TestBed.createComponent(DefaultCardHost);
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('[data-slot="card"]');

    expect(card.getAttribute('data-size')).toBe('default');
  });

  it('exposes the size input on the directive instance, defaulted from config', () => {
    const fixture = TestBed.createComponent(DefaultCardHost);
    fixture.detectChanges();
    const directive = fixture.debugElement.query(By.directive(HlmCard)).injector.get(HlmCard);

    expect(directive.size()).toBe('default');
  });

  it('applies a custom size', () => {
    const fixture = TestBed.createComponent(CustomCardHost);
    fixture.detectChanges();

    fixture.componentInstance.size.set('sm');
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('[data-slot="card"]');

    expect(card.getAttribute('data-size')).toBe('sm');
  });

  it('uses a provided HlmCardConfig for the default size', () => {
    const fixture = TestBed.createComponent(ConfiguredCardHost);
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('[data-slot="card"]');

    expect(card.getAttribute('data-size')).toBe('sm');
  });

  it('falls back to the default config when none is provided', () => {
    TestBed.runInInjectionContext(() => {
      expect(injectHlmCardConfig()).toEqual({ size: 'default' });
    });
  });
});
