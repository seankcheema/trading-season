import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { DuaFigureComponent, DuaMood } from './dua-figure.component';

export type DuaPeekSide = 'left' | 'right';

export interface DuaSidePeek {
  readonly side: DuaPeekSide;
  // Distance from the top of the viewport, as a percentage of its height.
  readonly top: number;
  readonly mood: DuaMood;
}

// How long one peek lasts, matching the dua-side-peek animation, and the quiet spells around it.
export const PEEK_DURATION = 3600;
export const FIRST_PEEK_DELAY = { min: 2_000, max: 5_000 };
export const PEEK_INTERVAL = { min: 20_000, max: 40_000 };

const MOODS: readonly DuaMood[] = ['happy', 'peek', 'excited'];

function between(range: { min: number; max: number }): number {
  return range.min + Math.random() * (range.max - range.min);
}

// Dua leaning in from the left or right edge of the window now and then, at a random height,
// and ducking back out, on the landing page. Purely decorative and never in the way: it takes
// no pointer events, and it stays hidden for reduced motion, while the tab is in the background
// and during server rendering.
@Component({
  selector: 'app-dua-side-peek',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DuaFigureComponent],
  host: { 'aria-hidden': 'true' },
  template: `
    @if (peek(); as peek) {
      <div
        class="dua-side-peek"
        data-testid="dua-side-peek"
        [attr.data-side]="peek.side"
        [style.top.%]="peek.top"
      >
        <app-dua-figure [framed]="false" [mood]="peek.mood" />
      </div>
    }
  `,
  styles: `
    /* A strip at the window's edge clips everything of Dua past the edge, so Dua appears to
       lean out from behind it. The figure pivots on the middle of its open base, which sits on
       the edge. */
    .dua-side-peek {
      --dua-size: 120px;
      position: fixed;
      z-index: 40;
      width: var(--dua-size);
      height: var(--dua-size);
      overflow: hidden;
      pointer-events: none;
      transform: translateY(-50%);
    }

    .dua-side-peek[data-side='right'] {
      right: 0;
    }

    .dua-side-peek[data-side='left'] {
      left: 0;
    }

    /* Turned on its side, Dua's open base lies along the edge, and leaning a little in the
       middle of the peek never shows it. */
    app-dua-figure {
      position: absolute;
      top: calc(50% - var(--dua-size));
      width: var(--dua-size);
      height: var(--dua-size);
      transform-origin: 50% 100%;
      animation: dua-side-peek 3600ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }

    [data-side='right'] app-dua-figure {
      --dua-turn: -90deg;
      --dua-lean: -78deg;
      --dua-shown: 4%;
      --dua-hidden: 60%;
      right: calc(var(--dua-size) * -0.5);
    }

    [data-side='left'] app-dua-figure {
      --dua-turn: 90deg;
      --dua-lean: 78deg;
      --dua-shown: -4%;
      --dua-hidden: -60%;
      left: calc(var(--dua-size) * -0.5);
    }

    @keyframes dua-side-peek {
      0% {
        transform: translateX(var(--dua-hidden)) rotate(var(--dua-turn));
      }
      18%,
      42% {
        transform: translateX(var(--dua-shown)) rotate(var(--dua-turn));
      }
      54%,
      72% {
        transform: translateX(var(--dua-shown)) rotate(var(--dua-lean));
      }
      84% {
        transform: translateX(var(--dua-shown)) rotate(var(--dua-turn));
      }
      100% {
        transform: translateX(var(--dua-hidden)) rotate(var(--dua-turn));
      }
    }

    @media (min-width: 48rem) {
      .dua-side-peek {
        --dua-size: 144px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .dua-side-peek {
        display: none;
      }
    }
  `,
})
export class DuaSidePeekComponent {
  readonly peek = signal<DuaSidePeek | null>(null);

  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    this.schedule(between(FIRST_PEEK_DELAY));
    inject(DestroyRef).onDestroy(() => {
      if (this.timer !== null) clearTimeout(this.timer);
    });
  }

  private schedule(delay: number): void {
    this.timer = setTimeout(() => this.show(), delay);
  }

  private show(): void {
    if (!this.canPeek()) {
      this.schedule(between(PEEK_INTERVAL));
      return;
    }
    this.peek.set({
      side: Math.random() < 0.5 ? 'left' : 'right',
      top: Math.round(25 + Math.random() * 50),
      mood: MOODS[Math.floor(Math.random() * MOODS.length)],
    });
    this.timer = setTimeout(() => {
      this.peek.set(null);
      this.schedule(between(PEEK_INTERVAL));
    }, PEEK_DURATION);
  }

  private canPeek(): boolean {
    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return !reducedMotion && document.visibilityState !== 'hidden';
  }
}
