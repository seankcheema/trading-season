import React from 'react';

const W = 100, H = 24, P = 3;

// app-daily-sparkline: dashed baseline at the first value, gain/loss line and end dot.
export function Sparkline({ points = [], height = 24, style }) {
  if (!points.length) return <span style={{ display: 'block', height, ...style }} />;
  const base = points[0];
  const min = Math.min(...points, base), max = Math.max(...points, base);
  const range = max - min || 1;
  const y = (v) => H - P - ((v - min) / range) * (H - P * 2);
  const last = Math.max(points.length - 1, 1);
  const xy = points.map((v, i) => [(i / last) * W, y(v)]);
  const up = points[points.length - 1] >= base;
  const c = up ? 'var(--color-gain)' : 'var(--color-loss)';
  const d = xy.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ');
  const end = xy[xy.length - 1];
  return (
    <span style={{ display: 'block', height, width: '100%', minWidth: 0, ...style }}>
      <svg viewBox={'0 0 ' + W + ' ' + H} preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '100%', overflow: 'visible' }} aria-hidden="true">
        <line x1="0" x2={W} y1={y(base)} y2={y(base)} stroke="rgba(238,250,255,.105)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        <path d={d} fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <circle cx={end[0]} cy={end[1]} r="1.8" fill={c} />
      </svg>
    </span>
  );
}
