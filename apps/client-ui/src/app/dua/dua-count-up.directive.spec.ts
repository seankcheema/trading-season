import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { countUpText, DuaCountUpDirective } from './dua-count-up.directive';

describe('countUpText', () => {
  it('starts at zero and ends at the value, keeping its format', () => {
    expect(countUpText('+$1,234.56', 0)).toBe('+$0.00');
    expect(countUpText('+$1,234.56', 1)).toBe('+$1,234.56');
    expect(countUpText('-2.4%', 0)).toBe('-0.0%');
    expect(countUpText('-2.4%', 1)).toBe('-2.4%');
    expect(countUpText('3 of 5', 1)).toBe('3 of 5');
  });

  it('eases toward the value and groups digits only when the value does', () => {
    expect(countUpText('1000', 0.5)).toBe('875');
    expect(countUpText('1,000', 0.5)).toBe('875');
    expect(countUpText('$20,000', 0.5)).toBe('$17,500');
  });

  it('has nothing to count without a non-zero number', () => {
    expect(countUpText('n/a', 0.5)).toBeNull();
    expect(countUpText('$0.00', 0.5)).toBeNull();
  });
});

@Component({
  imports: [DuaCountUpDirective],
  template: `<span [duaCountUp]="value()" [duaCountUpActive]="active()">{{ value() }}</span>`,
})
class CountUpHost {
  readonly value = signal('$1,000');
  readonly active = signal(true);
}

describe('DuaCountUpDirective', () => {
  const original = window.matchMedia;
  let frames: FrameRequestCallback[];
  let cancel: ReturnType<typeof vi.fn>;
  const motion = (reduced: boolean) => {
    window.matchMedia = ((query: string) => ({ matches: reduced, media: query })) as never;
  };
  beforeEach(() => {
    frames = [];
    cancel = vi.fn();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      frames.push(callback),
    );
    vi.stubGlobal('cancelAnimationFrame', cancel);
    vi.spyOn(performance, 'now').mockReturnValue(0);
  });
  afterEach(() => {
    window.matchMedia = original;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  // The directive's own frame; Angular schedules frames of its own too.
  const step = () => frames.filter((f) => f.name === 'step').at(-1)!;
  const render = () => {
    const fixture = TestBed.createComponent(CountUpHost);
    fixture.detectChanges();
    TestBed.tick();
    return { fixture, span: fixture.nativeElement.querySelector('span') as HTMLElement };
  };

  it('counts up frame by frame, then shows the real text', () => {
    motion(false);
    const { span } = render();
    expect(span.classList).toContain('counting');
    expect(span.dataset['count']).toBe('$0');
    step()(350);
    expect(span.dataset['count']).toBe('$875');
    step()(700);
    expect(span.classList).not.toContain('counting');
    expect(span.dataset['count']).toBeUndefined();
  });

  it('cancels the count when its card stops being active', () => {
    motion(false);
    const { fixture, span } = render();
    fixture.componentInstance.active.set(false);
    fixture.detectChanges();
    TestBed.tick();
    expect(cancel).toHaveBeenCalled();
    expect(span.classList).not.toContain('counting');
  });

  it('does not count under reduced motion', () => {
    motion(true);
    const { span } = render();
    expect(frames.some((f) => f.name === 'step')).toBe(false);
    expect(span.classList).not.toContain('counting');
  });
});
