import * as React from 'react';

/**
 * HeaderDropdown — dashboard header menu (market clock, account switcher, profile avatar). Also exports MenuItem.
 */
export interface HeaderDropdownProps {
  /** Lucide icon for the default trigger */
  icon?: string;
  label?: React.ReactNode;
  /** Custom trigger content — renders the 36px cyan avatar circle ("SC") */
  trigger?: React.ReactNode;
  triggerStyle?: React.CSSProperties;
  /** Trigger width (default 240) */
  width?: number | string;
  panelWidth?: number | string;
  panelStyle?: React.CSSProperties;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  ariaLabel?: string;
  /** Node, or (close) => node */
  children?: React.ReactNode | ((close: () => void) => React.ReactNode);
  style?: React.CSSProperties;
}
export function HeaderDropdown(props: HeaderDropdownProps): JSX.Element;
export function MenuItem(props: { icon?: string; tone?: 'primary' | 'danger'; trailing?: React.ReactNode; onClick?: () => void; style?: React.CSSProperties; children?: React.ReactNode }): JSX.Element;
