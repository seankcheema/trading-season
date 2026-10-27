import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  DuaSidePeekComponent,
  FIRST_PEEK_DELAY,
  PEEK_DURATION,
  PEEK_INTERVAL,
} from './dua-side-peek.component';

describe('DuaSidePeekComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function render() {
    const fixture = TestBed.createComponent(DuaSidePeekComponent);
    fixture.detectChanges();
    const figure = () =>
      fixture.nativeElement.querySelector('[data-testid="dua-side-peek"]') as HTMLElement | null;
    const advance = (ms: number) => {
      vi.advanceTimersByTime(ms);
      fixture.detectChanges();
    };
    return { fixture, figure, advance };
  }

  it('peeks in from a side after a while, ducks out, and comes back later', () => {
    const { fixture, figure, advance } = render();

    expect(fixture.nativeElement.getAttribute('aria-hidden')).toBe('true');
    advance(FIRST_PEEK_DELAY.min - 1);
    expect(figure()).toBeNull();

    advance(1);
    expect(figure()!.getAttribute('data-side')).toBe('left');
    expect(figure()!.style.top).toBe('25%');

    advance(PEEK_DURATION);
    expect(figure()).toBeNull();

    advance(PEEK_INTERVAL.min);
    expect(figure()).not.toBeNull();
  });

  it('skips its turn while the tab is in the background', () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const { figure, advance } = render();

    advance(FIRST_PEEK_DELAY.min);
    expect(figure()).toBeNull();

    visibility.mockReturnValue('visible');
    advance(PEEK_INTERVAL.min);
    expect(figure()).not.toBeNull();
  });

  it('never peeks during server rendering', () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const { figure, advance } = render();

    advance(FIRST_PEEK_DELAY.max + PEEK_INTERVAL.max);
    expect(figure()).toBeNull();
  });
});
