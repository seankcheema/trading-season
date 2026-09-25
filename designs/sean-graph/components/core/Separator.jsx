import React from 'react';

export function Separator({ orientation = 'horizontal', style, ...rest }) {
  const v = orientation === 'vertical';
  return <div role="separator" aria-orientation={orientation} style={{ flexShrink: 0, background: 'var(--border)', width: v ? 1 : '100%', height: v ? 'auto' : 1, alignSelf: v ? 'stretch' : undefined, ...style }} {...rest} />;
}

export function Label({ children, style, ...rest }) {
  return <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, lineHeight: 1, fontWeight: 500, userSelect: 'none', ...style }} {...rest}>{children}</label>;
}
