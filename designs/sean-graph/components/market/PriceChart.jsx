import React, { useState, useRef } from 'react';

const W = 100, H = 40, PAD = 2;
let chartId = 0;

function smooth(c) {
  if (!c.length) return '';
  let d = 'M ' + c[0].x.toFixed(2) + ',' + c[0].y.toFixed(2);
  for (let i = 0; i < c.length - 1; i++) {
    const p = c[i - 1] || c[i], cur = c[i], n = c[i + 1], a = c[i + 2] || n;
    d += ' C ' + (cur.x + (n.x - p.x) / 6).toFixed(2) + ',' + (cur.y + (n.y - p.y) / 6).toFixed(2) + ' ' +
      (n.x - (a.x - cur.x) / 6).toFixed(2) + ',' + (n.y - (a.y - cur.y) / 6).toFixed(2) + ' ' + n.x.toFixed(2) + ',' + n.y.toFixed(2);
  }
  return d;
}
const money0 = (v) => '$' + Math.round(v).toLocaleString('en-US');
const money2 = (v) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// app-price-chart: smooth gain/loss line, optional area fill, y-axis on the right, hover crosshair + label row.
export function PriceChart({ points = [], labels = [], area, height = 224, style }) {
  const [hover, setHover] = useState(null);
  const plot = useRef(null);
  const [gid] = useState(() => 'ts-pc-' + chartId++);
  if (!points.length) return <div style={{ height, ...style }} />;
  const min = Math.min(...points), max = Math.max(...points);
  const range = max - min || 1;
  const yPct = (v) => ((H - PAD - ((v - min) / range) * (H - PAD * 2)) / H) * 100;
  const last = Math.max(points.length - 1, 1);
  const coords = points.map((v, i) => ({ x: (i / last) * 100, y: yPct(v) }));
  const svg = coords.map((c) => ({ x: (c.x / 100) * W, y: (c.y / 100) * H }));
  const line = smooth(svg);
  const up = points[points.length - 1] >= points[0];
  const color = up ? 'var(--color-gain)' : 'var(--color-loss)';
  const yTicks = [0, 1, 2, 3, 4].map((i) => { const v = max - (range / 4) * i; return { v, y: yPct(v) }; });
  const xTicks = labels.length ? labels.map((l, i) => ({ l, x: labels.length === 1 ? 0 : (i / (labels.length - 1)) * 100 })) : [];
  const edge = (x) => (x < 12 ? 'translateX(0)' : x > 88 ? 'translateX(-100%)' : 'translateX(-50%)');
  const hp = hover != null ? coords[hover] : null;
  const endPt = coords[coords.length - 1];
  const move = (e) => { const r = plot.current.getBoundingClientRect(); const t = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); setHover(Math.round(t * last)); };
  const pct = hover != null ? ((points[hover] - points[0]) / points[0]) * 100 : 0;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 4.75rem', gridTemplateRows: '1.25rem minmax(0,1fr) 1rem', columnGap: 12, rowGap: 8, height, ...style }}>
      <div style={{ position: 'relative', minWidth: 0 }}>
        {hp ? (
          <div style={{ position: 'absolute', top: 0, left: hp.x + '%', transform: edge(hp.x), whiteSpace: 'nowrap', fontSize: 13, lineHeight: '20px', fontVariantNumeric: 'tabular-nums', display: 'flex', gap: 4 }}>
            <span style={{ fontWeight: 600 }}>{money2(points[hover])}</span>
            <span style={{ color: pct >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>{(pct >= 0 ? '+' : '') + pct.toFixed(2) + '%'}</span>
            {labels.length ? <span style={{ color: 'var(--muted-foreground)' }}>· {labels[Math.round((hover / last) * (labels.length - 1))]}</span> : null}
          </div>
        ) : null}
      </div>
      <div />
      <div ref={plot} onPointerMove={move} onPointerLeave={() => setHover(null)} style={{ position: 'relative', minHeight: 0, borderRadius: 2, touchAction: 'pan-y' }}>
        {hp ? <div style={{ position: 'absolute', top: 0, bottom: 0, left: hp.x + '%', width: 1, background: 'var(--foreground-40)', pointerEvents: 'none' }} /> : null}
        <svg viewBox={'0 0 ' + W + ' ' + H} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }} aria-hidden="true">
          {area ? <defs><linearGradient id={gid} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={up ? '#33ff00' : '#ff0037'} stopOpacity="0.28" /><stop offset="1" stopColor={up ? '#33ff00' : '#ff0037'} stopOpacity="0" /></linearGradient></defs> : null}
          {yTicks.map((t) => <line key={t.v} x1="0" x2={W} y1={(t.y / 100) * H} y2={(t.y / 100) * H} stroke="rgba(238,250,255,.09)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />)}
          {xTicks.map((t) => <line key={t.l + t.x} x1={t.x} x2={t.x} y1="0" y2={H} stroke="rgba(238,250,255,.0525)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />)}
          <line x1="0" x2={W} y1={H} y2={H} stroke="var(--border)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
          {area ? <path d={line + ' L ' + W + ',' + H + ' L 0,' + H + ' Z'} fill={'url(#' + gid + ')'} /> : null}
          <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {(hp || endPt) ? (
          <div style={{ position: 'absolute', zIndex: 10, left: (hp || endPt).x + '%', top: Math.min(98, Math.max(2, (hp || endPt).y)) + '%', width: hp ? 10 : 8, height: hp ? 10 : 8, borderRadius: '50%', transform: 'translate(-50%,-50%)', background: color, boxShadow: '0 0 0 2px var(--card)', pointerEvents: 'none' }} />
        ) : null}
      </div>
      <div style={{ position: 'relative', minHeight: 0, borderLeft: '1px solid rgba(238,250,255,.105)', textAlign: 'right', fontSize: 11, color: 'var(--muted-foreground)', fontVariantNumeric: 'tabular-nums' }}>
        {yTicks.map((t) => <span key={t.v} style={{ position: 'absolute', right: 0, top: t.y + '%', transform: 'translateY(-50%)', whiteSpace: 'nowrap' }}>{money0(t.v)}</span>)}
      </div>
      <div style={{ position: 'relative', height: 16, fontSize: 12, color: 'var(--muted-foreground)' }}>
        {xTicks.map((t) => <span key={t.l + t.x} style={{ position: 'absolute', top: 0, left: t.x + '%', transform: edge(t.x), whiteSpace: 'nowrap' }}>{t.l}</span>)}
      </div>
      <div />
    </div>
  );
}

// Deterministic fake series ending at endValue (port of mockPriceSeries).
export function mockSeries(seed, count, endValue) {
  let s = 0;
  for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  const walk = []; let v = 100;
  for (let i = 0; i < count; i++) { s = (s * 1664525 + 1013904223) >>> 0; v += ((s / 2 ** 32 - 0.45) * 20) / Math.sqrt(count); walk.push(v); }
  const k = endValue / walk[walk.length - 1];
  return walk.map((w) => w * k);
}
