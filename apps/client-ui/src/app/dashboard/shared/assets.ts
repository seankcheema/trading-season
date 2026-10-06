import { Instrument } from '../mock-data';
import { SortDirection } from './activity';

// One position in an account's portfolio, valued at the latest price.
export interface PricedHolding {
  symbol: string;
  shares: number;
  // Average cost per share, used to derive gain/loss.
  costBasis: number;
  instrument: Instrument;
  value: number;
  gainLoss: number;
}

// One line of the full assets table: a holding plus what only the whole portfolio can tell.
export interface AssetRow {
  symbol: string;
  name: string;
  instrument: Instrument;
  shares: number;
  costBasis: number;
  price: number;
  changePercent: number;
  value: number;
  gainLoss: number;
  // Gain or loss against the average cost, in percent.
  returnPercent: number;
  // Share of the portfolio's market value, in percent.
  weight: number;
}

export interface AssetSummary {
  marketValue: number;
  costBasis: number;
  unrealized: number;
  positions: number;
}

export type AssetSortKey =
  | 'symbol'
  | 'shares'
  | 'costBasis'
  | 'price'
  | 'changePercent'
  | 'value'
  | 'gainLoss'
  | 'returnPercent'
  | 'weight';
export type AssetFilter = 'all' | 'gainers' | 'losers';

export function summarizeAssets(holdings: readonly PricedHolding[]): AssetSummary {
  return {
    marketValue: holdings.reduce((total, holding) => total + holding.value, 0),
    costBasis: holdings.reduce((total, holding) => total + holding.shares * holding.costBasis, 0),
    unrealized: holdings.reduce((total, holding) => total + holding.gainLoss, 0),
    positions: holdings.length,
  };
}

export function assetRows(holdings: readonly PricedHolding[]): AssetRow[] {
  const total = summarizeAssets(holdings).marketValue;
  return holdings.map((holding) => ({
    symbol: holding.symbol,
    name: holding.instrument.name,
    instrument: holding.instrument,
    shares: holding.shares,
    costBasis: holding.costBasis,
    price: holding.instrument.price,
    changePercent: holding.instrument.changePercent,
    value: holding.value,
    gainLoss: holding.gainLoss,
    returnPercent:
      holding.costBasis > 0
        ? ((holding.instrument.price - holding.costBasis) / holding.costBasis) * 100
        : 0,
    weight: total > 0 ? (holding.value / total) * 100 : 0,
  }));
}

// Rows that break even are neither gainers nor losers.
export function matchesAssetFilter(row: AssetRow, filter: AssetFilter): boolean {
  switch (filter) {
    case 'gainers':
      return row.gainLoss > 0;
    case 'losers':
      return row.gainLoss < 0;
    default:
      return true;
  }
}

export function matchesAssetQuery(row: AssetRow, query: string): boolean {
  const term = query.trim().toLowerCase();
  return !term || row.symbol.toLowerCase().includes(term) || row.name.toLowerCase().includes(term);
}

// Sorts a copy. Ties fall back to the ticker so the order is stable between price ticks.
export function sortAssetRows(
  rows: readonly AssetRow[],
  key: AssetSortKey,
  direction: SortDirection,
): AssetRow[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = a[key];
    const y = b[key];
    if (x === y) return a.symbol.localeCompare(b.symbol);
    return (typeof x === 'string' ? x.localeCompare(y as string) : x - (y as number)) * sign;
  });
}
