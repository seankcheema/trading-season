import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DuaFigureComponent, DuaMood } from './dua-figure.component';

@Component({
  imports: [DuaFigureComponent],
  template: `
    <app-dua-figure [mood]="mood()" [wiggle]="wiggle()" [sweating]="sweating()" />
    <app-dua-figure [framed]="false" />
  `,
})
class HostComponent {
  readonly mood = signal<DuaMood>('happy');
  readonly wiggle = signal(false);
  readonly sweating = signal(false);
}

describe('DuaFigureComponent', () => {
  function render() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const [framed, unframed] = fixture.nativeElement.querySelectorAll('app-dua-figure');
    return { fixture, framed: framed as HTMLElement, unframed: unframed as HTMLElement };
  }

  it('is decorative, and clips to its round frame with an id of its own', () => {
    const { framed, unframed } = render();

    expect(framed.getAttribute('aria-hidden')).toBe('true');
    const clip = framed.querySelector('clipPath')!.id;
    expect(framed.querySelector('.art')!.getAttribute('clip-path')).toBe(`url(#${clip})`);
    expect(unframed.querySelector('clipPath')).toBeNull();
    expect(unframed.querySelector('.art')!.getAttribute('clip-path')).toBeNull();
  });

  it('changes expression with its mood and waggles its fin on request', () => {
    const { fixture, framed } = render();
    const eyes = () => framed.querySelectorAll('circle.ink').length;
    expect(framed.getAttribute('data-mood')).toBe('happy');
    expect(eyes()).toBe(2);

    fixture.componentInstance.mood.set('sleepy');
    fixture.componentInstance.wiggle.set(true);
    fixture.detectChanges();
    expect(framed.getAttribute('data-mood')).toBe('sleepy');
    expect(eyes()).toBe(0);
    expect(framed.classList).toContain('wiggle');

    fixture.componentInstance.mood.set('worried');
    fixture.detectChanges();
    expect(framed.querySelector('.drop')).not.toBeNull();
    // The flippers are always drawn so they can slide up over the eyes.
    expect(framed.querySelectorAll('.flipper')).toHaveLength(2);
  });

  it('sweats only on request, so a worried face keeps a still drop by default', () => {
    const { fixture, framed } = render();
    fixture.componentInstance.mood.set('worried');
    fixture.detectChanges();
    expect(framed.classList).not.toContain('sweating');

    fixture.componentInstance.sweating.set(true);
    fixture.detectChanges();
    expect(framed.classList).toContain('sweating');
    expect(framed.querySelector('.drop')).not.toBeNull();

    fixture.componentInstance.sweating.set(false);
    fixture.detectChanges();
    expect(framed.classList).not.toContain('sweating');
  });
});
