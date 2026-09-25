import React, { useState } from 'react';
import { Icon } from './Icon.jsx';

const SIZES = {
  xs: { height: 24, padding: '0 8px', fontSize: 12, gap: 4, borderRadius: 6, icon: 12 },
  sm: { height: 28, padding: '0 10px', fontSize: '0.8rem', gap: 4, borderRadius: 6, icon: 14 },
  default: { height: 32, padding: '0 10px', fontSize: 14, gap: 6, borderRadius: 8, icon: 16 },
  lg: { height: 36, padding: '0 10px', fontSize: 14, gap: 6, borderRadius: 8, icon: 16 },
  cta: { height: 48, padding: '0 32px', fontSize: 16, gap: 8, borderRadius: 5, fontWeight: 600, icon: 16 },
  icon: { width: 32, height: 32, padding: 0, borderRadius: 8, icon: 16 },
  'icon-sm': { width: 28, height: 28, padding: 0, borderRadius: 6, icon: 14 },
  'icon-lg': { width: 36, height: 36, padding: 0, borderRadius: 8, icon: 16 },
};

function variantStyle(variant, hover) {
  switch (variant) {
    case 'outline': return { background: hover ? 'var(--input-50)' : 'var(--input-30)', borderColor: 'var(--input)', color: 'var(--foreground)' };
    case 'secondary': return { background: hover ? 'rgba(26,26,26,.8)' : 'var(--secondary)', color: 'var(--secondary-foreground)' };
    case 'ghost': return { background: hover ? 'rgba(26,26,26,.5)' : 'transparent', color: 'var(--foreground)' };
    case 'destructive': return { background: hover ? 'rgba(255,0,55,.3)' : 'rgba(255,0,55,.2)', color: 'var(--destructive)' };
    case 'sell': return { background: hover ? 'var(--loss-85)' : 'var(--color-loss)', color: '#fff' };
    case 'glass': return { background: hover ? 'rgba(238,250,255,.12)' : 'rgba(238,250,255,.06)', borderColor: 'rgba(238,250,255,.12)', color: 'var(--foreground)' };
    case 'link': return { background: 'transparent', color: 'var(--primary)', textDecoration: hover ? 'underline' : 'none', textUnderlineOffset: 4 };
    default: return { background: hover ? 'var(--primary-80)' : 'var(--primary)', color: 'var(--primary-foreground)' };
  }
}

export function Button({ variant = 'default', size = 'default', radius, icon, iconEnd, fullWidth, disabled, loading, children, style, onClick, type = 'button', ...rest }) {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);
  const s = SIZES[size] || SIZES.default;
  const { icon: iconSize, ...box } = s;
  const off = disabled || loading;
  return (
    <button
      type={type}
      disabled={off}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        whiteSpace: 'nowrap', border: '1px solid transparent', backgroundClip: 'padding-box',
        fontFamily: 'inherit', fontWeight: 500, cursor: off ? 'not-allowed' : 'pointer',
        transition: 'all 150ms', outline: 'none', userSelect: 'none',
        opacity: off ? 0.5 : 1, transform: press && !off ? 'translateY(1px)' : 'none',
        width: fullWidth ? '100%' : box.width,
        ...box, ...(radius != null ? { borderRadius: radius } : null),
        ...variantStyle(variant, hover && !off), ...style,
      }}
      {...rest}
    >
      {icon ? <Icon name={icon} size={iconSize} /> : null}
      {children}
      {iconEnd ? <Icon name={iconEnd} size={iconSize} /> : null}
    </button>
  );
}
