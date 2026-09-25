/** Sparkline — 24px intraday line for table rows (app-daily-sparkline). Green if last ≥ first, red otherwise. */
export interface SparklineProps {
  /** Price values, oldest first */
  points: number[];
  height?: number;
  style?: React.CSSProperties;
}
export function Sparkline(props: SparklineProps): JSX.Element;
