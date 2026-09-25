import * as React from 'react';

/** Lucide icon (the codebase uses @ng-icons/lucide). Pass kebab-case names: "mail", "eye-off", "calendar-clock". */
export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Lucide icon name in kebab-case */
  name: string;
  /** Pixel size. Product uses 12, 14, 16 (default), 18, 24 */
  size?: number;
  /** Defaults to currentColor */
  color?: string;
  /** Accessible label; omit for decorative icons */
  label?: string;
}
export function Icon(props: IconProps): JSX.Element;
