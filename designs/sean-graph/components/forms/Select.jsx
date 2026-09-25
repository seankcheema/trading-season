import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '../core/Icon.jsx';
import { controlStyle } from './Input.jsx';

// hlm-select: custom trigger + popover listbox with a check on the active item.
export function Select({ options = [], value, onChange, placeholder = 'Select…', size = 'default', width, disabled, style }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
  const cur = opts.find((o) => o.value === value);
  return (
    <div ref={ref} style={{ position: 'relative', width: width || 'fit-content', ...style }}>
      <button type="button" disabled={disabled} onClick={() => setOpen(!open)}
        style={{ ...controlStyle({ focus: open, disabled, height: size === 'sm' ? 28 : 32, radius: size === 'sm' ? 6 : 8 }), width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '0 8px 0 10px', cursor: 'pointer', whiteSpace: 'nowrap', color: cur ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
        <span>{cur ? cur.label : placeholder}</span>
        <Icon name="chevron-down" size={16} style={{ color: 'var(--muted-foreground)' }} />
      </button>
      {open ? (
        <div role="listbox" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: '100%', zIndex: 40, background: 'var(--popover)', color: 'var(--popover-foreground)', borderRadius: 8, boxShadow: '0 0 0 1px var(--foreground-10), var(--shadow-md)', padding: 4, maxHeight: 288, overflowY: 'auto', animation: 'ts-pop-in 100ms ease-out' }}>
          {opts.map((o, i) => (
            <div key={o.value} role="option" aria-selected={o.value === value}
              onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(-1)}
              onClick={() => { onChange && onChange(o.value); setOpen(false); }}
              style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 32px 4px 6px', borderRadius: 6, fontSize: 14, cursor: 'default', whiteSpace: 'nowrap', background: hi === i ? 'var(--accent)' : 'transparent' }}>
              {o.label}
              {o.value === value ? <Icon name="check" size={16} style={{ position: 'absolute', right: 8 }} /> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
