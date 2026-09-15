import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

// Drawing space for the decorative graph; the SVG stretches it to fill the page width.
const WIDTH = 1440;
const HEIGHT = 420;
// The line stops short of the right edge so its latest point stays visible past the fade.
const LINE_END_X = WIDTH * 0.86;
const POINT_COUNT = 64;
// How often a new price arrives; the line scrolls smoothly between arrivals.
const TICK_MS = 900;
// How quickly the vertical scale follows the visible range (per frame, 0-1).
const SCALE_EASING = 0.06;

interface GraphLine {
  line: string;
  area: string;
  end: { x: number; y: number };
}

interface Scale {
  min: number;
  max: number;
}

// Deterministic random walk with an upward drift, so the prerendered page and the client
// start from the same shape.
class Walk {
  private state: number;
  private value = 0;
  readonly values: number[];

  constructor(
    seed: number,
    private readonly drift: number,
  ) {
    this.state = seed;
    // One extra value: the incoming point the line eases toward.
    this.values = Array.from({ length: POINT_COUNT + 1 }, () => this.step());
  }

  advance(): void {
    this.values.shift();
    this.values.push(this.step());
  }

  private step(): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    this.value += this.state / 2 ** 32 - 0.5 + this.drift;
    return this.value;
  }
}

function range(values: number[]): Scale {
  return { min: Math.min(...values), max: Math.max(...values) };
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

// Visible y values at `phase` (0-1) of the way to the next tick. The newest point eases
// toward the incoming value while everything else slides left by `phase` of a step.
function visibleValues(walk: Walk, phase: number): number[] {
  const { values } = walk;
  const last = values[POINT_COUNT - 1];
  const incoming = values[POINT_COUNT];
  return [...values.slice(0, POINT_COUNT), last + (incoming - last) * smoothstep(phase)];
}

// Maps values into the drawing space, `scale.min` at `bottom` and `scale.max` at `top`.
function toGraphLine(values: number[], phase: number, scale: Scale, top: number, bottom: number): GraphLine {
  const span = scale.max - scale.min || 1;
  const step = LINE_END_X / (POINT_COUNT - 1);
  const points = values.map((value, i) => ({
    // The final value is pinned to the line's end; the rest scroll left.
    x: i === values.length - 1 ? LINE_END_X : (i - phase) * step,
    y: bottom - ((value - scale.min) / span) * (bottom - top),
  }));
  const line = points.map(({ x, y }, i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const end = points[points.length - 1];
  return {
    line,
    area: `${line} L${end.x.toFixed(1)} ${HEIGHT} L${points[0].x.toFixed(1)} ${HEIGHT} Z`,
    end: { x: (end.x / WIDTH) * 100, y: (end.y / HEIGHT) * 100 },
  };
}

@Component({
  selector: 'app-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
})
export class LandingComponent {
  protected readonly viewBox = `0 0 ${WIDTH} ${HEIGHT}`;
  protected readonly gridLines = [0.25, 0.5, 0.75].map((ratio) => ratio * HEIGHT);
  protected readonly lineEndX = LINE_END_X;

  private readonly primaryWalk = new Walk(7, 0.18);
  private readonly ghostWalk = new Walk(42, 0.08);
  private primaryScale = range(visibleValues(this.primaryWalk, 0));
  private ghostScale = range(visibleValues(this.ghostWalk, 0));

  // Bumped once per animation frame; the graph geometry is derived from it.
  private readonly frame = signal({ phase: 0 });

  protected readonly primary = computed(() => {
    const { phase } = this.frame();
    return toGraphLine(visibleValues(this.primaryWalk, phase), phase, this.primaryScale, 70, 370);
  });

  protected readonly ghost = computed(() => {
    const { phase } = this.frame();
    return toGraphLine(visibleValues(this.ghostWalk, phase), phase, this.ghostScale, 150, 390);
  });

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      let start = performance.now();
      const tick = (now: number) => {
        // Catch up on ticks missed while the tab was hidden, without replaying a backlog.
        const ticks = Math.floor((now - start) / TICK_MS);
        if (ticks > 0) {
          for (let i = 0; i < Math.min(ticks, POINT_COUNT); i++) {
            this.primaryWalk.advance();
            this.ghostWalk.advance();
          }
          start += ticks * TICK_MS;
        }

        const phase = Math.max(0, now - start) / TICK_MS;
        this.primaryScale = this.easeScale(this.primaryScale, visibleValues(this.primaryWalk, phase));
        this.ghostScale = this.easeScale(this.ghostScale, visibleValues(this.ghostWalk, phase));
        this.frame.set({ phase });

        handle = requestAnimationFrame(tick);
      };
      let handle = requestAnimationFrame(tick);

      destroyRef.onDestroy(() => cancelAnimationFrame(handle));
    });
  }

  // Glides the vertical scale toward the visible range so the line never jumps.
  private easeScale(current: Scale, values: number[]): Scale {
    const target = range(values);
    return {
      min: current.min + (target.min - current.min) * SCALE_EASING,
      max: current.max + (target.max - current.max) * SCALE_EASING,
    };
  }
}
