import * as React from 'react';

/**
 * Field — hlmField wrapper: label, control, helper text or error. Also exports FieldLabel, FieldDescription, FieldError, FieldChecklist.
 * @startingPoint section="Forms" subtitle="Labelled field with helper, error and rule checklist" viewport="700x360"
 */
export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode;
  htmlFor?: string;
  /** Muted helper text; hidden when error is present */
  description?: React.ReactNode;
  /** Red validation message ("Enter a valid email address.") */
  error?: React.ReactNode;
  children?: React.ReactNode;
}
export function Field(props: FieldProps): JSX.Element;
export function FieldLabel(props: React.LabelHTMLAttributes<HTMLLabelElement>): JSX.Element;
export function FieldDescription(props: React.HTMLAttributes<HTMLParagraphElement> & { size?: 'sm' | 'xs' }): JSX.Element;
export function FieldError(props: React.HTMLAttributes<HTMLParagraphElement>): JSX.Element;
export function FieldChecklist(props: { items: { label: string; met: boolean }[]; style?: React.CSSProperties }): JSX.Element;
