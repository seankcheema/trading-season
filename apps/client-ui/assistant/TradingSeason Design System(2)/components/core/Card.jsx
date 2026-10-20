import React from 'react';

// hlmCard: ring-1 foreground/10, bg-card, rounded-xl, --card-spacing 16px (12px when size="sm").
export function Card({ size = 'default', radius = 12, children, style, ...rest }) {
  const sp = size === 'sm' ? 12 : 16;
  const hasFooter = React.Children.toArray(children).some((c) => c && c.type === CardFooter);
  return (
    <div
      data-size={size}
      style={{
        '--card-spacing': sp + 'px', display: 'flex', flexDirection: 'column', gap: sp,
        paddingTop: sp, paddingBottom: hasFooter ? 0 : sp, overflow: 'hidden',
        background: 'var(--card)', color: 'var(--card-foreground)', borderRadius: radius,
        boxShadow: '0 0 0 1px var(--foreground-10)', fontSize: 14, ...style,
      }}
      {...rest}
    >{children}</div>
  );
}
export function CardHeader({ children, style, align, ...rest }) {
  return <div style={{ display: 'grid', gap: 4, padding: '0 var(--card-spacing)', textAlign: align, ...style }} {...rest}>{children}</div>;
}
export function CardTitle({ as: Tag = 'h3', children, style, ...rest }) {
  return <Tag style={{ margin: 0, fontSize: 16, lineHeight: 1.375, fontWeight: 500, ...style }} {...rest}>{children}</Tag>;
}
export function CardDescription({ children, style, ...rest }) {
  return <p style={{ margin: 0, fontSize: 14, color: 'var(--muted-foreground)', ...style }} {...rest}>{children}</p>;
}
export function CardContent({ children, style, ...rest }) {
  return <div style={{ padding: '0 var(--card-spacing)', ...style }} {...rest}>{children}</div>;
}
export function CardFooter({ children, style, ...rest }) {
  return <div style={{ display: 'flex', alignItems: 'center', padding: 'var(--card-spacing)', background: 'rgba(26,26,26,.5)', borderTop: '1px solid var(--border)', ...style }} {...rest}>{children}</div>;
}
