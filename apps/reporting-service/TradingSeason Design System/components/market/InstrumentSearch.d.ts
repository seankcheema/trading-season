/**
 * InstrumentSearch — ticker/company combobox (app-instrument-search). Arrow keys + Enter select; Escape clears.
 */
export interface Instrument { symbol: string; name: string; price: number; change: number; changePercent: number }
export interface InstrumentSearchProps {
  instruments: Instrument[];
  onSelect?: (instrument: Instrument) => void;
  /** lg = 70px hero search with 24px text */
  size?: 'md' | 'lg';
  placeholder?: string;
  style?: React.CSSProperties;
}
export function InstrumentSearch(props: InstrumentSearchProps): JSX.Element;
