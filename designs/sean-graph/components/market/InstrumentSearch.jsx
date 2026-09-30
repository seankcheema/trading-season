import React, { useState } from 'react';
import { Icon } from '../core/Icon.jsx';

const money = (v) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v) => (v >= 0 ? '+' : '') + v.toFixed(2) + '%';

// app-instrument-search: combobox with symbol/name/price/change rows.
export function InstrumentSearch({ instruments = [], onSelect, size = 'md', placeholder = 'Search', style }) {
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(false);
  const [active, setActive] = useState(0);
  const term = q.trim().toLowerCase();
  const results = term ? instruments.filter((i) => i.symbol.toLowerCase().includes(term) || i.name.toLowerCase().includes(term)) : [];
  const open = focus && term.length > 0;
  const lg = size === 'lg';
  const pick = (i) => { setQ(''); onSelect && onSelect(i); };
  const key = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); results.length && setActive((active + 1) % results.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); results.length && setActive((active - 1 + results.length) % results.length); }
    else if (e.key === 'Enter' && open && results[active]) { e.preventDefault(); pick(results[active]); }
    else if (e.key === 'Escape') setQ('');
  };
  return (
    <div style={{ position: 'relative', display: 'block', ...style }}>
      <Icon name="search" size={lg ? 24 : 16} style={{ position: 'absolute', left: 16, top: lg ? 35 : 22, transform: 'translateY(-50%)', color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
      <input type="search" role="combobox" aria-expanded={open} autoComplete="off" placeholder={placeholder} value={q}
        onChange={(e) => { setQ(e.target.value); setActive(0); }} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} onKeyDown={key}
        style={{ width: '100%', height: lg ? 70 : 44, padding: lg ? '0 16px 0 56px' : '0 16px 0 44px', fontSize: lg ? 24 : 14, borderRadius: 12, border: '1px solid ' + (focus ? 'var(--ring)' : 'var(--border)'), background: 'var(--card)', color: 'var(--foreground)', outline: 'none', transition: 'border-color 150ms' }} />
      {open ? (
        <ul role="listbox" style={{ position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 20, marginTop: 4, maxHeight: 320, overflowY: 'auto', listStyle: 'none', padding: '4px 0', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--popover)', boxShadow: 'var(--shadow-lg)' }}>
          {results.length ? results.map((i, idx) => (
            <li key={i.symbol} role="option" aria-selected={idx === active} onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setActive(idx)} onClick={() => pick(i)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '8px 16px', cursor: 'pointer', background: idx === active ? 'var(--muted)' : 'transparent' }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>{i.symbol}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.name}</span>
              </span>
              <span style={{ flexShrink: 0, textAlign: 'right', fontSize: 14 }}>
                <span style={{ display: 'block' }}>{money(i.price)}</span>
                <span style={{ display: 'block', fontSize: 12, color: i.changePercent >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>{pct(i.changePercent)}</span>
              </span>
            </li>
          )) : <li style={{ padding: '8px 16px', fontSize: 14, color: 'var(--muted-foreground)' }}>No instruments match "{q}"</li>}
        </ul>
      ) : null}
    </div>
  );
}
