import * as React from 'react';

/**
 * Card — hlmCard with Header / Title / Description / Content / Footer parts. Used for auth forms.
 * Also exports CardHeader, CardTitle, CardDescription, CardContent, CardFooter.
 * @startingPoint section="Core" subtitle="Auth-style card with footer" viewport="700x320"
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** sm tightens card spacing from 16px to 12px */
  size?: 'default' | 'sm';
  /** Corner radius; auth screens use 10 */
  radius?: number;
  children?: React.ReactNode;
}
export function Card(props: CardProps): JSX.Element;
export function CardHeader(props: React.HTMLAttributes<HTMLDivElement> & { align?: 'left' | 'center' }): JSX.Element;
export function CardTitle(props: React.HTMLAttributes<HTMLHeadingElement> & { as?: any }): JSX.Element;
export function CardDescription(props: React.HTMLAttributes<HTMLParagraphElement>): JSX.Element;
export function CardContent(props: React.HTMLAttributes<HTMLDivElement>): JSX.Element;
export function CardFooter(props: React.HTMLAttributes<HTMLDivElement>): JSX.Element;
