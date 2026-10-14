import React, { useState } from 'react';
import { Icon } from '../core/Icon.jsx';
import { controlStyle } from './Input.jsx';

// hlm-native-select: real <select> with a chevron-down overlay.
export function NativeSelect({ options = [], value, onChange, radius = 8, size = 'default', invalid, disabled, style, id, ...rest }) {
  const [focus, setFocus] = useState(false);
  const h = size === 'sm' ? 28 : 32;
  return (
    <div style={{ position: 'relative', width: '100%', opacity: disabled ? 0.5 : 1, ...style }}>
      <select id={id} value={value} disabled={disabled} onChange={(e) => onChange && onChange(e.target.value, e)}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{ ...controlStyle({ focus, invalid, radius, height: h }), appearance: 'none', WebkitAppearance: 'none', padding: '4px 32px 4px 10px', cursor: 'pointer' }} {...rest}>
        {options.map((o) => {
          const opt = typeof o === 'object' ? o : { value: o, label: o };
          return <option key={opt.value} value={opt.value} style={{ background: 'var(--popover)' }}>{opt.label}</option>;
        })}
      </select>
      <Icon name="chevron-down" size={16} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
    </div>
  );
}
