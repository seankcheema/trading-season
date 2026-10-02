import { monotonePath, timePosition } from './portfolio-axis';
describe('portfolio axis and curves', () => {
  it('keeps equal session widths across weekends and missing seeded days', () => {
    const domain = {
      start: 0,
      end: 1050,
      sessions: [
        { start: 0, end: 100 },
        { start: 1000, end: 1050 },
      ],
    };
    expect(timePosition(50, domain)).toBe(25);
    expect(timePosition(1025, domain)).toBe(75);
    expect(timePosition(500, domain)).toBe(50);
  });
  it('maps sparse samples against fixed boundaries rather than stretching the final sample', () => {
    expect(timePosition(25, { start: 0, end: 100 })).toBe(25);
    expect(timePosition(-1, { start: 0, end: 100 })).toBe(0);
    expect(timePosition(101, { start: 0, end: 100 })).toBe(100);
  });
  it('passes through endpoints, keeps flat segments flat, and makes trades sharp', () => {
    const path = monotonePath([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20.001, y: 10, transition: true },
      { x: 40, y: 12 },
      { x: 100, y: 11 },
    ]);
    expect(path).toContain('L 20.0010,10.0000');
    expect(path).toContain('100.0000,11.0000');
    expect(path).toMatch(/C [0-9.]+,0.0000 [0-9.]+,0.0000 20.0000,0.0000/);
  });
  it('keeps sampled cubic values within each pair of endpoint values without overshoot', () => {
    const source = [
      { x: 0, y: 1 },
      { x: 1, y: 9 },
      { x: 30, y: 2 },
      { x: 31, y: 2 },
      { x: 100, y: 7 },
    ];
    const segments = [
      ...monotonePath(source).matchAll(
        /C ([0-9.-]+),([0-9.-]+) ([0-9.-]+),([0-9.-]+) ([0-9.-]+),([0-9.-]+)/g,
      ),
    ];
    expect(segments).toHaveLength(4);
    segments.forEach((segment, i) => {
      for (let t = 0; t <= 1; t += 0.05) {
        const value =
          (1 - t) ** 3 * source[i].y +
          3 * (1 - t) ** 2 * t * Number(segment[2]) +
          3 * (1 - t) * t * t * Number(segment[4]) +
          t ** 3 * Number(segment[6]);
        expect(value).toBeGreaterThanOrEqual(Math.min(source[i].y, source[i + 1].y) - 0.001);
        expect(value).toBeLessThanOrEqual(Math.max(source[i].y, source[i + 1].y) + 0.001);
      }
    });
  });
});
