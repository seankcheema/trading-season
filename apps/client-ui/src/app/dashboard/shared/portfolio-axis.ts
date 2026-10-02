export interface TradingInterval {
  start: number;
  end: number;
}
export interface ChartTimeDomain {
  start: number;
  end: number;
  sessions?: readonly TradingInterval[];
}
export interface CurvePoint {
  x: number;
  y: number;
  transition?: boolean;
}

export function timePosition(time: number, domain: ChartTimeDomain): number {
  if (domain.sessions?.length) {
    const sessions = domain.sessions;
    for (let i = 0; i < sessions.length; i++) {
      if (time <= sessions[i].end)
        return Math.max(
          0,
          Math.min(
            100,
            ((i + Math.max(0, (time - sessions[i].start) / (sessions[i].end - sessions[i].start))) /
              sessions.length) *
              100,
          ),
        );
    }
    return 100;
  }
  return domain.end > domain.start
    ? Math.max(0, Math.min(100, ((time - domain.start) / (domain.end - domain.start)) * 100))
    : 0;
}

// Limited Hermite tangents keep every Bezier segment within its endpoint values.
export function monotonePath(points: readonly CurvePoint[]): string {
  if (!points.length) return '';
  const f = (value: number) => value.toFixed(4);
  const commands = [`M ${f(points[0].x)},${f(points[0].y)}`];
  let start = 0;
  while (start < points.length - 1) {
    let end = start + 1;
    while (end < points.length && !points[end].transition && points[end].x > points[end - 1].x)
      end++;
    const part = points.slice(start, end);
    const slopes = part.slice(1).map((point, i) => (point.y - part[i].y) / (point.x - part[i].x));
    const tangents = part.map((_, i) =>
      i === 0
        ? (slopes[0] ?? 0)
        : i === part.length - 1
          ? slopes[i - 1]
          : slopes[i - 1] * slopes[i] <= 0
            ? 0
            : 2 / (1 / slopes[i - 1] + 1 / slopes[i]),
    );
    for (let i = 0; i < slopes.length; i++) {
      if (!slopes[i]) {
        tangents[i] = 0;
        tangents[i + 1] = 0;
      } else {
        const norm = Math.hypot(tangents[i] / slopes[i], tangents[i + 1] / slopes[i]);
        if (norm > 3) {
          tangents[i] *= 3 / norm;
          tangents[i + 1] *= 3 / norm;
        }
      }
    }
    for (let i = 0; i < part.length - 1; i++) {
      const a = part[i],
        b = part[i + 1],
        dx = (b.x - a.x) / 3;
      commands.push(
        `C ${f(a.x + dx)},${f(a.y + dx * tangents[i])} ${f(b.x - dx)},${f(b.y - dx * tangents[i + 1])} ${f(b.x)},${f(b.y)}`,
      );
    }
    if (end < points.length) commands.push(`L ${f(points[end].x)},${f(points[end].y)}`);
    start = end;
  }
  return commands.join(' ');
}
