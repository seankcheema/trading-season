import { DestroyRef, Directive, ElementRef, effect, inject, input, untracked } from '@angular/core';

const NUMBER = /\d[\d,]*(?:\.\d+)?/;
const DURATION = 700;

/**
 * The text a formatted value shows `progress` (0 to 1) of the way through counting up from zero,
 * keeping its prefix, suffix, grouping and decimal places; null when it has nothing to count.
 */
export function countUpText(value: string, progress: number): string | null {
  const match = NUMBER.exec(value);
  const target = match ? Number(match[0].replaceAll(',', '')) : 0;
  if (!match || !target) {
    return null;
  }
  const decimals = match[0].split('.')[1]?.length ?? 0;
  const eased = 1 - (1 - Math.min(Math.max(progress, 0), 1)) ** 3;
  const current = (target * eased).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: match[0].includes(','),
  });
  return value.slice(0, match.index) + current + value.slice(match.index + match[0].length);
}

/**
 * Counts a metric up from zero each time its card becomes active. The element keeps its real text
 * for assistive technology and layout; the counting figure is drawn over it by CSS from
 * `data-count` while the `counting` class is set. Nothing runs under reduced motion.
 */
@Directive({ selector: '[duaCountUp]' })
export class DuaCountUpDirective {
  readonly duaCountUp = input.required<string>();
  readonly duaCountUpActive = input(true);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private frame = 0;

  constructor() {
    effect(() => {
      const value = this.duaCountUp();
      const active = this.duaCountUpActive();
      untracked(() => (active ? this.start(value) : this.stop()));
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  private start(value: string): void {
    this.stop();
    const motion =
      typeof window.matchMedia === 'function' &&
      typeof requestAnimationFrame === 'function' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!motion || countUpText(value, 0) === null) {
      return;
    }
    const started = performance.now();
    const step = (now: number) => {
      const progress = (now - started) / DURATION;
      if (progress >= 1) {
        this.stop();
        return;
      }
      this.element.dataset['count'] = countUpText(value, progress)!;
      this.frame = requestAnimationFrame(step);
    };
    this.element.dataset['count'] = countUpText(value, 0)!;
    this.element.classList.add('counting');
    this.frame = requestAnimationFrame(step);
  }

  private stop(): void {
    if (this.frame) {
      cancelAnimationFrame(this.frame);
    }
    this.frame = 0;
    this.element.classList.remove('counting');
    delete this.element.dataset['count'];
  }
}
