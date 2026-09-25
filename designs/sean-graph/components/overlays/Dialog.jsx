import React, { useEffect, useState } from 'react';
import { Icon } from '../core/Icon.jsx';

export function CloseButton({ onClick, label = 'Close dialog' }) {
  const [h, setH] = useState(false);
  return (
    <button type="button" aria-label={label} onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 0, borderRadius: 8, cursor: 'pointer', transition: 'all 150ms', background: h ? 'var(--muted)' : 'transparent', color: h ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
      <Icon name="x" size={18} />
    </button>
  );
}

// app-dashboard-dialog: blurred scrim, 16px-radius card, bordered header, Escape closes.
export function Dialog({ title, onClose, width = 448, padded = true, closeLabel, inline, children, style }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape' && onClose) onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  const card = (
    <section role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
      style={{ width: '100%', maxWidth: width, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow-dialog)', animation: 'ts-pop-in 200ms cubic-bezier(0.16,1,0.3,1) both', ...style }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{title}</h2>
        <CloseButton onClick={onClose} label={closeLabel} />
      </header>
      <div style={{ padding: padded ? 20 : 0 }}>{children}</div>
    </section>
  );
  if (inline) return card;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto', padding: '48px 16px', background: 'var(--scrim)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', animation: 'ts-fade-in 150ms ease-out both' }}>
      {card}
    </div>
  );
}
