import { signal } from '@angular/core';

export type TickAnimation = {
  direction: 'gain' | 'loss';
  durationMs: number;
  revision: number;
};

/**
 * The price flashes on screen: which symbols are flashing now, in which direction, and for how
 * long. Each new tick on a symbol restarts its flash with a fresh `revision` so the page can
 * replay the animation.
 */
export class TickAnimations {
  readonly current = signal(new Map<string, TickAnimation>());
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Starts, or restarts, the flash on one symbol; it clears itself after 500 to 1,000 ms. */
  start(symbol: string, direction: TickAnimation['direction']): void {
    const existingTimer = this.timers.get(symbol);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    const durationMs = 500 + Math.floor(Math.random() * 501);
    this.current.update((animations) => {
      const next = new Map(animations);
      const revision = (next.get(symbol)?.revision ?? 0) + 1;
      next.set(symbol, { direction, durationMs, revision });
      return next;
    });
    const timer = setTimeout(() => {
      this.timers.delete(symbol);
      this.current.update((animations) => {
        const next = new Map(animations);
        next.delete(symbol);
        return next;
      });
    }, durationMs);
    this.timers.set(symbol, timer);
  }

  /** Stops every flash at once. */
  clear(): void {
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    this.current.set(new Map());
  }
}
