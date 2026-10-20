/**
 * TimeframeToggle — 1D / 5D / 1M / 1Y chart range segment (app-timeframe-toggle). Also exports SideToggle (Buy / Sell).
 */
export interface TimeframeToggleProps {
  value?: string;
  onChange?: (value: string) => void;
  /** Defaults to ['1D','5D','1M','1Y'] */
  options?: string[];
  style?: React.CSSProperties;
}
export function TimeframeToggle(props: TimeframeToggleProps): JSX.Element;
export function SideToggle(props: { value?: 'buy' | 'sell'; onChange?: (v: 'buy' | 'sell') => void; style?: React.CSSProperties }): JSX.Element;
