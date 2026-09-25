import React from 'react';
import { Icon } from '../core/Icon.jsx';

// hlmField: vertical stack, gap 8, label + control + description/error.
export function Field({ label, htmlFor, description, error, children, style, ...rest }) {
  return (
    <div role="group" style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', ...style }} {...rest}>
      {label ? <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel> : null}
      {children}
      {description && !error ? <FieldDescription>{description}</FieldDescription> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}
export function FieldLabel({ children, style, ...rest }) {
  return <label style={{ display: 'flex', width: 'fit-content', gap: 8, fontSize: 14, fontWeight: 500, lineHeight: 1.375, color: 'var(--foreground)', userSelect: 'none', ...style }} {...rest}>{children}</label>;
}
export function FieldDescription({ children, size = 'sm', style, ...rest }) {
  return <p style={{ margin: 0, fontSize: size === 'xs' ? 12 : 14, lineHeight: 1.5, color: 'var(--muted-foreground)', ...style }} {...rest}>{children}</p>;
}
export function FieldError({ children, style, ...rest }) {
  return <p role="alert" style={{ margin: 0, fontSize: 14, color: 'var(--destructive)', ...style }} {...rest}>{children}</p>;
}
// Password rule checklist from register.component.html
export function FieldChecklist({ items = [], style }) {
  return (
    <ul style={{ listStyle: 'none', margin: '4px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 2, ...style }}>
      {items.map((it) => (
        <li key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: it.met ? '#33FF00' : 'var(--muted-foreground)' }}>
          <Icon name={it.met ? 'check' : 'x'} size={12} />{it.label}
        </li>
      ))}
    </ul>
  );
}
