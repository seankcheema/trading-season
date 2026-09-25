import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '../core/Icon.jsx';

// app-dashboard-header-dropdown: bordered trigger (icon · label · chevron) with a floating panel.
export function HeaderDropdown({ icon, label, trigger, triggerStyle, width = 240, panelWidth, panelStyle, open: openProp, onOpenChange, children, style, ariaLabel }) {
  const [inner, setInner] = useState(false);
  const [h, setH] = useState(false);
  const open = openProp != null ? openProp : inner;
  const set = (v) => { setInner(v); onOpenChange && onOpenChange(v); };
  const ref = useRef(null);
  useEffect(() => {
    const c = (e) => { if (ref.current && !ref.current.contains(e.target)) set(false); };
    document.addEventListener('mousedown', c);
    return () => document.removeEventListener('mousedown', c);
  });
  const custom = !!trigger;
  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 0, width: custom ? undefined : width, flexShrink: custom ? 0 : undefined, ...style }}>
      <button type="button" aria-label={ariaLabel} aria-expanded={open} onClick={() => set(!open)} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
        style={custom
          ? { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 9999, border: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--primary)', background: h || open ? 'var(--primary-25)' : 'var(--primary-15)', transition: 'background 150ms', ...triggerStyle }
          : { display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 14, background: h || open ? 'var(--muted)' : 'var(--card)', transition: 'background 150ms', ...triggerStyle }}>
        {custom ? trigger : (
          <>
            {icon ? <Icon name={icon} size={16} /> : null}
            <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', textAlign: 'left', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
            <Icon name="chevron-down" size={14} style={{ color: 'var(--muted-foreground)' }} />
          </>
        )}
      </button>
      {open ? (
        <div style={{ position: 'absolute', top: 44, right: 0, zIndex: 30, width: panelWidth || (custom ? 192 : '100%'), overflow: 'hidden', padding: 4, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', boxShadow: 'var(--shadow-xl)', ...panelStyle }}>
          {typeof children === 'function' ? children(() => set(false)) : children}
        </div>
      ) : null}
    </div>
  );
}

export function MenuItem({ icon, tone, children, trailing, onClick, style }) {
  const [h, setH] = useState(false);
  const danger = tone === 'danger';
  return (
    <button type="button" role="menuitem" onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 36, padding: '6px 8px', borderRadius: 8, border: 0, textAlign: 'left', fontSize: 14, cursor: 'pointer', transition: 'background 150ms',
        color: danger ? 'var(--color-loss)' : tone === 'primary' ? 'var(--primary)' : 'var(--foreground)',
        background: h ? (danger ? 'var(--loss-10)' : 'var(--muted)') : 'transparent', ...style }}>
      {icon ? <Icon name={icon} size={16} /> : null}
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
      {trailing}
    </button>
  );
}
