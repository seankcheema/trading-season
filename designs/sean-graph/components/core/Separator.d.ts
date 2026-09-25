import * as React from 'react';

/** Separator — 1px hairline in --border (hlmSeparator). Also exports Label (hlmLabel). */
export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
}
export function Separator(props: SeparatorProps): JSX.Element;
export function Label(props: React.LabelHTMLAttributes<HTMLLabelElement>): JSX.Element;
