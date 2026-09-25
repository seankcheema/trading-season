import React, { useState } from 'react';

const TIMEFRAMES = ['1D', '5D', '1M', '1Y'];

export function TimeframeToggle({ value = '1D', onChange, options = TIMEFRAMES, style }) {
  const [hov, setHov] = useState(null);
  return (
    <div role="group" aria-label="Chart timeframe" style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 8, background: 'var(--muted)', width: 'fit-content', ...style }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <button key={o} type="button" aria-pressed={on} onClick={() => onChange && onChange(o)}
            onMouseEnter={() => setHov(o)} onMouseLeave={() => setHov(null)}
            style={{ cursor: 'pointer', border: 0, borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 500, transition: 'color 150ms, background 150ms',
              background: on ? 'var(--primary)' : 'transparent', color: on ? 'var(--primary-foreground)' : hov === o ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

// Buy / Sell order-side segment from order-submission.component.html
export function SideToggle({ value = 'buy', onChange, style }) {
  const [hov, setHov] = useState(null);
  return (
    <div role="group" aria-label="Order side" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: 4, borderRadius: 12, background: 'var(--muted)', ...style }}>
      {['buy', 'sell'].map((o) => {
        const on = o === value;
        const bg = on ? (o === 'buy' ? 'var(--primary)' : 'var(--color-loss)') : 'transparent';
        const fg = on ? (o === 'buy' ? 'var(--primary-foreground)' : '#fff') : hov === o ? 'var(--foreground)' : 'var(--muted-foreground)';
        return (
          <button key={o} type="button" aria-pressed={on} onClick={() => onChange && onChange(o)}
            onMouseEnter={() => setHov(o)} onMouseLeave={() => setHov(null)}
            style={{ height: 36, cursor: 'pointer', border: 0, borderRadius: 8, fontSize: 14, fontWeight: 500, textTransform: 'capitalize', background: bg, color: fg, transition: 'color 150ms, background 150ms' }}>
            {o}
          </button>
        );
      })}
    </div>
  );
}
