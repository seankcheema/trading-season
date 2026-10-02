/**
 * PriceChart — app-price-chart: smooth line in gain/loss color, right y-axis, bottom time labels, hover crosshair.
 * Module also exports lowercase helper mockSeries(seed, count, endValue) (import directly; not on the namespace).
 * @startingPoint section="Market" subtitle="Portfolio / instrument price chart" viewport="700x300"
 */
export interface PriceChartProps {
  /** Values oldest first */
  points: number[];
  /** Evenly spaced x-axis labels ("9:30 AM", "Sep 8") */
  labels?: string[];
  /** Gradient fill under the line (portfolio chart) */
  area?: boolean;
  /** Pixel height of the whole chart grid */
  height?: number;
  style?: React.CSSProperties;
}
export function PriceChart(props: PriceChartProps): JSX.Element;
