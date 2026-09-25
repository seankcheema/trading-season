import * as React from 'react';

/**
 * Input — hlmInput with the product's leading-icon and show/hide-password patterns.
 * @startingPoint section="Forms" subtitle="Text inputs, icons, reveal, invalid" viewport="700x360"
 */
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'style'> {
  /** Leading Lucide icon (mail, lock, map-pin, dollar-sign) */
  icon?: string;
  /** Adds the eye / eye-off toggle and manages password visibility */
  reveal?: boolean;
  /** 8 default; auth + dialogs use 5 */
  radius?: number;
  height?: number;
  invalid?: boolean;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
}
export function Input(props: InputProps): JSX.Element;
