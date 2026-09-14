import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// Drawing space for the decorative graph; the SVG stretches it to fill the page width.
const WIDTH = 1440;
const HEIGHT = 420;
// The line stops short of the right edge so its latest point stays visible past the fade.
const LINE_END_X = WIDTH * 0.86;

interface GraphLine {
  line: string;
  area: string;
  end: { x: number; y: number };
}

// Deterministic random walk with an upward drift, so the prerendered page and the client
// draw the same shape.
function walk(seed: number, count: number, drift: number): number[] {
  let state = seed;
  let value = 0;
  return Array.from({ length: count }, () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    value += state / 2 ** 32 - 0.5 + drift;
    return value;
  });
}

// Maps values into the drawing space, lowest value at `bottom` and highest at `top`.
function toGraphLine(values: number[], top: number, bottom: number): GraphLine {
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  const points = values.map((value, i) => ({
    x: (i / (values.length - 1)) * LINE_END_X,
    y: bottom - ((value - min) / range) * (bottom - top),
  }));
  const line = points.map(({ x, y }, i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const end = points[points.length - 1];
  return {
    line,
    area: `${line} L${end.x.toFixed(1)} ${HEIGHT} L0 ${HEIGHT} Z`,
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

  protected readonly primary = toGraphLine(walk(7, 64, 0.18), 70, 370);
  protected readonly ghost = toGraphLine(walk(42, 64, 0.08), 150, 390);
}
