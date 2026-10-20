import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '../core/Icon.jsx';

const money = (v) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v) => (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');

function Kbd({ children }) {
  return <kbd style={{ display: 'inline-flex', minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', padding: '0 5px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--muted)', color: 'var(--muted-foreground)', fontFamily: 'inherit', fontSize: 11, fontWeight: 500, lineHeight: 1 }}>{children}</kbd>;
}

// app-instrument-search: combobox with symbol/name/price/change rows.
// Optional: keyboard shortcut (/ and ⌘K) with hint, grouped suggestions when focused and empty, trailing Trade button.
export function InstrumentSearch({ instruments = [], onSelect, size = 'md', placeholder = 'Search', embedded, autoFocus, shortcut, suggestions, action, style }) {
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(false);
  const [active, setActive] = useState(0);
  const [btnHover, setBtnHover] = useState(false);
  const input = useRef(null);
  const term = q.trim().toLowerCase();
  const results = term ? instruments.filter((i) => i.symbol.toLowerCase().includes(term) || i.name.toLowerCase().includes(term)) : [];
  const groups = !term && suggestions ? suggestions.filter((g) => g.items && g.items.length) : [];
  const flat = term ? results : groups.flatMap((g) => g.items);
  const open = focus && (term.length > 0 || groups.length > 0);
  const lg = size === 'lg';
  const pick = (i) => { setQ(''); input.current && input.current.blur(); onSelect && onSelect(i); };

  useEffect(() => {
    if (!shortcut) return;
    const k = (e) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName);
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); input.current && input.current.focus(); }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [shortcut]);

  const key = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); flat.length && setActive((active + 1) % flat.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); flat.length && setActive((active - 1 + flat.length) % flat.length); }
    else if (e.key === 'Enter' && open && flat[active]) { e.preventDefault(); pick(flat[active]); }
    else if (e.key === 'Escape') { if (q) setQ(''); else input.current && input.current.blur(); }
  };

  const row = (i, idx) => (
    <li key={(term ? 'r' : 's') + idx + i.symbol} role="option" aria-selected={idx === active} onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setActive(idx)} onClick={() => pick(i)}
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
  );

  let n = 0;
  const showHint = shortcut && !focus && !q;
  const padRight = (action ? (lg ? 92 : 84) : 16) + (showHint ? 64 : 0);
  return (
    <div style={{ position: 'relative', display: 'block', ...style }}>
      <div style={{ position: 'relative' }}>
        <Icon name="search" size={lg ? 18 : 16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: focus && action ? 'var(--primary)' : 'var(--muted-foreground)', pointerEvents: 'none', transition: 'color 150ms' }} />
        <input ref={input} type="search" autoFocus={autoFocus} role="combobox" aria-expanded={open} aria-keyshortcuts={shortcut ? '/ Control+K Meta+K' : undefined} autoComplete="off" placeholder={placeholder} value={q}
          onChange={(e) => { setQ(e.target.value); setActive(0); }} onFocus={() => { setFocus(true); setActive(0); }} onBlur={() => setFocus(false)} onKeyDown={key}
          style={{ width: '100%', height: lg ? 48 : 44, padding: (lg ? '0 ' + padRight + 'px 0 48px' : '0 ' + padRight + 'px 0 44px'), fontSize: lg ? 16 : 14, color: 'var(--foreground)', outline: 'none', transition: 'border-color 150ms, box-shadow 150ms', ...(embedded ? { border: 0, borderBottom: '1px solid var(--border)', borderRadius: 0, background: 'transparent' } : { borderRadius: 12, border: '1px solid ' + (focus ? 'var(--ring)' : 'var(--border)'), background: 'var(--card)', boxShadow: focus && action ? '0 0 0 3px var(--ring-50)' : 'none' }) }} />
        {showHint || action ? (
          <div style={{ position: 'absolute', right: lg ? 6 : 5, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 10 }}>
            {showHint ? <span aria-hidden="true" style={{ display: 'flex', gap: 4, pointerEvents: 'none' }}><Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd><Kbd>K</Kbd></span> : null}
            {action ? (
              <button type="button" onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setBtnHover(true)} onMouseLeave={() => setBtnHover(false)}
                onClick={() => { if (term && results[0]) pick(results[0]); else { input.current && input.current.focus(); action.onClick && action.onClick(); } }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: lg ? 36 : 34, padding: '0 14px', border: 0, borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, background: btnHover ? 'var(--primary-80)' : 'var(--primary)', color: 'var(--primary-foreground)', transition: 'background 150ms' }}>
                <Icon name={action.icon || 'arrow-right-left'} size={14} />{action.label || 'Trade'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {open ? (
        <ul role="listbox" style={embedded ? { maxHeight: 256, overflowY: 'auto', listStyle: 'none', margin: 0, padding: '4px 0' } : { position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 20, marginTop: 4, maxHeight: 360, overflowY: 'auto', listStyle: 'none', padding: '4px 0', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--popover)', boxShadow: 'var(--shadow-lg)' }}>
          {term ? (results.length ? results.map((i, idx) => row(i, idx)) : <li style={{ padding: '8px 16px', fontSize: 14, color: 'var(--muted-foreground)' }}>No instruments match "{q}"</li>)
            : groups.map((g, gi) => (
              <li key={g.label} role="presentation" style={{ borderTop: gi ? '1px solid var(--border-60)' : 0, marginTop: gi ? 4 : 0, paddingTop: gi ? 4 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px 4px', color: 'var(--muted-foreground)', fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{g.icon ? <Icon name={g.icon} size={12} /> : null}{g.label}</div>
                <ul role="group" aria-label={g.label} style={{ listStyle: 'none', margin: 0, padding: 0 }}>{g.items.map((i) => row(i, n++))}</ul>
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}
