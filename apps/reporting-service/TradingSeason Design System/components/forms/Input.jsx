import React, { useState } from 'react';
import { Icon } from '../core/Icon.jsx';

export function controlStyle({ focus, invalid, disabled, radius = 8, height = 32 }) {
  return {
    height, width: '100%', minWidth: 0, borderRadius: radius, fontSize: 14, fontFamily: 'inherit',
    color: 'var(--foreground)', background: disabled ? 'rgba(238,250,255,.12)' : 'var(--input-30)',
    border: '1px solid ' + (invalid ? 'rgba(255,0,55,.5)' : focus ? 'var(--ring)' : 'var(--input)'),
    boxShadow: focus ? '0 0 0 3px ' + (invalid ? 'rgba(255,0,55,.4)' : 'var(--ring-50)') : 'none',
    outline: 'none', transition: 'border-color 150ms, box-shadow 150ms', opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'not-allowed' : undefined,
  };
}

export function Input({ icon, reveal, type = 'text', radius = 8, height = 32, invalid, disabled, style, inputStyle, onFocus, onBlur, ...rest }) {
  const [focus, setFocus] = useState(false);
  const [shown, setShown] = useState(false);
  const [hov, setHov] = useState(false);
  const realType = reveal ? (shown ? 'text' : 'password') : type;
  return (
    <div style={{ position: 'relative', width: '100%', ...style }}>
      {icon ? <Icon name={icon} size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', pointerEvents: 'none' }} /> : null}
      <input
        type={realType}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onFocus={(e) => { setFocus(true); onFocus && onFocus(e); }}
        onBlur={(e) => { setFocus(false); onBlur && onBlur(e); }}
        style={{ ...controlStyle({ focus, invalid, disabled, radius, height }), padding: '4px ' + (reveal ? 32 : 10) + 'px 4px ' + (icon ? 32 : 10) + 'px', ...inputStyle }}
        {...rest}
      />
      {reveal ? (
        <button type="button" aria-label={shown ? 'Hide password' : 'Show password'} onClick={() => setShown(!shown)}
          onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', background: 'transparent', border: 0, padding: 0, cursor: 'pointer', color: hov ? 'var(--foreground)' : 'var(--muted-foreground)', transition: 'color 150ms' }}>
          <Icon name={shown ? 'eye-off' : 'eye'} size={16} />
        </button>
      ) : null}
    </div>
  );
}
