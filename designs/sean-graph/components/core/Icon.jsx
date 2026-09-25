import React from 'react';

const LUCIDE_BASE = 'https://unpkg.com/lucide-static@0.469.0/icons/';

// Lucide glyph rendered as a currentColor mask so it inherits text color like ng-icon does.
export function Icon({ name, size = 16, color, style, label, ...rest }) {
  const url = 'url(' + LUCIDE_BASE + name + '.svg)';
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{
        display: 'inline-block', flexShrink: 0, width: size, height: size,
        backgroundColor: color || 'currentColor',
        WebkitMask: url + ' center / contain no-repeat', mask: url + ' center / contain no-repeat',
        ...style,
      }}
      {...rest}
    />
  );
}
