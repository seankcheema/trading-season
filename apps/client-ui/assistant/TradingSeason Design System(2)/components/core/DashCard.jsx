import React from 'react';

// .dash-card and .net-worth-card from dashboard.component.css
export function DashCard({ variant = 'default', padding = 20, as: Tag = 'section', children, style, ...rest }) {
  const nw = variant === 'net-worth';
  return (
    <Tag
      style={{
        border: '1px solid ' + (nw ? 'rgba(0,187,255,.2)' : 'var(--border)'), borderRadius: 14,
        background: nw ? 'var(--gradient-net-worth)' : 'var(--card)', padding, minWidth: 0, ...style,
      }}
      {...rest}
    >{children}</Tag>
  );
}

// .dash-label: quiet uppercase section label
export function DashLabel({ as: Tag = 'h2', children, style, ...rest }) {
  return <Tag style={{ margin: 0, color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', ...style }} {...rest}>{children}</Tag>;
}

// .dash-link: muted 12px text button that turns cyan on hover
export function DashLink({ children, style, onClick, ...rest }) {
  const [h, setH] = React.useState(false);
  return <button type="button" onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', fontSize: 12, color: h ? 'var(--primary)' : 'var(--muted-foreground)', transition: 'color 150ms', ...style }} {...rest}>{children}</button>;
}
