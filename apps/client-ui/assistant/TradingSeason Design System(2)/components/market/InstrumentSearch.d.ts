/**
 * InstrumentSearch — ticker/company combobox (app-instrument-search). Arrow keys + Enter select; Escape clears.
 */
export interface Instrument { symbol: string; name: string; price: number; change: number; changePercent: number }
export interface InstrumentSearchProps {
  instruments: Instrument[];
  onSelect?: (instrument: Instrument) => void;
  /** md = 44px / 14px text; lg = 48px / 16px text (dashboard) */
  size?: 'md' | 'lg';
  placeholder?: string;
  /** Borderless bottom-rule input with inline results (compare picker) */
  embedded?: boolean;
  autoFocus?: boolean;
  /** Focus on "/" or ⌘K / Ctrl+K and show the ⌘K hint while idle */
  shortcut?: boolean;
  /** Groups listed when the field is focused and empty (Trending, Your watch list, Recently viewed) */
  suggestions?: { label: string; icon?: string; items: Instrument[] }[];
  /** Trailing cyan button inside the field. Opens the top match, or focuses the field when empty */
  action?: { label?: string; icon?: string; onClick?: () => void };
  style?: React.CSSProperties;
}
export function InstrumentSearch(props: InstrumentSearchProps): JSX.Element;
