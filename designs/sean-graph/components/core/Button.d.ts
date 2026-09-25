import * as React from 'react';

/**
 * Button — port of hlmBtn (SpartanNG) plus the product's auth, CTA, sell and glass patterns.
 * @startingPoint section="Core" subtitle="Primary cyan, outline, ghost, sell, glass" viewport="700x320"
 */
export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /** default = cyan primary. sell = loss red. glass = net-worth card secondary action */
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'sell' | 'glass' | 'link';
  /** cta = landing hero (48px, 5px radius, semibold) */
  size?: 'xs' | 'sm' | 'default' | 'lg' | 'cta' | 'icon' | 'icon-sm' | 'icon-lg';
  /** Override radius. Auth forms use 5, dialogs' order button uses 12 */
  radius?: number;
  /** Leading Lucide icon name */
  icon?: string;
  /** Trailing Lucide icon name */
  iconEnd?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  children?: React.ReactNode;
}
export function Button(props: ButtonProps): JSX.Element;
