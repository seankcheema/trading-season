import React from 'react';

export function formatSignedPercent(v) {
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

// Rounded-full change badge: gain/loss at 10%, or an uppercase 10px tag (buy / sell / deposit / withdrawal) at 15%.
export function ChangePill({ value, tone, tag, children, style }) {
  const t = tone || (value == null ? 'primary' : value >= 0 ? 'gain' : 'loss');
  const map = {
    gain: ['var(--color-gain)', tag ? 'var(--gain-15)' : 'var(--gain-10)'],
    loss: ['var(--color-loss)', tag ? 'var(--loss-15)' : 'var(--loss-10)'],
    primary: ['var(--primary)', 'var(--primary-15)'],
    muted: ['var(--muted-foreground)', 'var(--muted)'],
  };
  const [fg, bg] = map[t] || map.primary;
  return (
    <span style={{ display: 'inline-block', borderRadius: 9999, padding: '2px 8px', fontSize: tag ? 10 : 12, fontWeight: 500, textTransform: tag ? 'uppercase' : 'none', fontVariantNumeric: 'tabular-nums', color: fg, background: bg, whiteSpace: 'nowrap', ...style }}>
      {children != null ? children : formatSignedPercent(value)}
    </span>
  );
}
