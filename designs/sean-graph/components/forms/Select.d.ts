/** Select — hlm-select custom listbox with checkmark on the chosen option. */
export interface SelectProps {
  options: Array<string | { value: string; label: string }>;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  size?: 'default' | 'sm';
  /** CSS width of the trigger; defaults to fit-content */
  width?: number | string;
  disabled?: boolean;
  style?: React.CSSProperties;
}
export function Select(props: SelectProps): JSX.Element;
