/** NativeSelect — hlm-native-select; used for Trader level (register) and idle timeout (settings). */
export interface NativeSelectProps {
  /** Strings or {value,label} pairs */
  options: Array<string | { value: string; label: string }>;
  value?: string;
  onChange?: (value: string, event: any) => void;
  radius?: number;
  size?: 'default' | 'sm';
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
  style?: React.CSSProperties;
}
export function NativeSelect(props: NativeSelectProps): JSX.Element;
