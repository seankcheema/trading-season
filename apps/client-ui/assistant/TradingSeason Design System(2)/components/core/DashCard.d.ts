import * as React from 'react';

/**
 * DashCard — dashboard panel (.dash-card). Also exports DashLabel (uppercase section label) and DashLink ("View all").
 * @startingPoint section="Core" subtitle="Dashboard panel + net-worth gradient card" viewport="700x320"
 */
export interface DashCardProps extends React.HTMLAttributes<HTMLElement> {
  /** net-worth = cyan radial glow over deep-sea gradient */
  variant?: 'default' | 'net-worth';
  /** Padding in px (default 20 = p-5; ticker strip uses 6) */
  padding?: number;
  as?: any;
  children?: React.ReactNode;
}
export function DashCard(props: DashCardProps): JSX.Element;
export function DashLabel(props: React.HTMLAttributes<HTMLHeadingElement> & { as?: any }): JSX.Element;
export function DashLink(props: React.ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element;
