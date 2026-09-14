// Placeholder data for the dashboard skeleton.
// TODO: replace with the portfolio / market data services once the backend endpoints exist.

export type Timeframe = '1D' | '5D' | '1W' | '1M' | '1Y';

export const TIMEFRAMES: readonly Timeframe[] = ['1D', '5D', '1W', '1M', '1Y'];

export type OrderSide = 'buy' | 'sell';

export interface Instrument {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

export interface Holding {
  symbol: string;
  shares: number;
  // Average cost per share, used to derive gain/loss.
  costBasis: number;
}

export interface Transaction {
  symbol: string;
  side: OrderSide;
  shares: number;
  price: number;
  date: string;
}

export interface Account {
  id: string;
  name: string;
}

export interface OrderRequest {
  accountId: string;
  symbol: string;
  side: OrderSide;
  shares: number;
  price: number;
}

export const MOCK_ACCOUNTS: readonly Account[] = [
  { id: 'personal', name: 'Personal Investing Account' },
  { id: 'retirement', name: 'Retirement Account' },
];

export const MOCK_CASH_BALANCE = 10_000;

export const MOCK_INSTRUMENTS: readonly Instrument[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 316.59, change: 15.65, changePercent: 5.2 },
  { symbol: 'MSFT', name: 'Microsoft Corporation', price: 512.3, change: 6.12, changePercent: 1.21 },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 184.77, change: -3.41, changePercent: -1.81 },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', price: 231.05, change: 2.88, changePercent: 1.26 },
  { symbol: 'GOOGL', name: 'Alphabet Inc. Class A', price: 208.44, change: -1.02, changePercent: -0.49 },
  { symbol: 'TSLA', name: 'Tesla, Inc.', price: 347.12, change: 12.4, changePercent: 3.7 },
  { symbol: 'META', name: 'Meta Platforms, Inc.', price: 741.9, change: -9.33, changePercent: -1.24 },
  { symbol: 'SPCX', name: 'Space Exploration Holdings', price: 127.43, change: 6.3, changePercent: 5.2 },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', price: 289.61, change: 0.84, changePercent: 0.29 },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', price: 648.2, change: 3.15, changePercent: 0.49 },
];

export const MOCK_HOLDINGS: readonly Holding[] = [
  { symbol: 'AAPL', shares: 4, costBasis: 280.1 },
  { symbol: 'NVDA', shares: 10, costBasis: 190.25 },
  { symbol: 'MSFT', shares: 2, costBasis: 455.0 },
  { symbol: 'SPY', shares: 3, costBasis: 610.5 },
  { symbol: 'TSLA', shares: 1, costBasis: 301.8 },
];

export const MOCK_TRANSACTIONS: readonly Transaction[] = [
  { symbol: 'TSLA', side: 'buy', shares: 1, price: 301.8, date: '2026-09-12' },
  { symbol: 'SPY', side: 'buy', shares: 3, price: 610.5, date: '2026-09-10' },
  { symbol: 'META', side: 'sell', shares: 2, price: 752.1, date: '2026-09-08' },
  { symbol: 'MSFT', side: 'buy', shares: 2, price: 455.0, date: '2026-09-03' },
  { symbol: 'NVDA', side: 'buy', shares: 10, price: 190.25, date: '2026-08-28' },
  { symbol: 'AAPL', side: 'buy', shares: 4, price: 280.1, date: '2026-08-21' },
];

export function findInstrument(symbol: string): Instrument | undefined {
  return MOCK_INSTRUMENTS.find((instrument) => instrument.symbol === symbol);
}

export function searchInstruments(query: string): Instrument[] {
  const term = query.trim().toLowerCase();
  if (!term) {
    return [];
  }
  return MOCK_INSTRUMENTS.filter(
    (instrument) =>
      instrument.symbol.toLowerCase().includes(term) || instrument.name.toLowerCase().includes(term),
  );
}

// Deterministic fake price history so charts look stable across renders (and SSR/hydration).
export function mockPriceSeries(seed: string, timeframe: Timeframe, points = 12): number[] {
  let state = 0;
  for (const char of seed + timeframe) {
    state = (state * 31 + char.charCodeAt(0)) >>> 0;
  }

  const series: number[] = [];
  let value = 100;
  for (let i = 0; i < points; i++) {
    state = (state * 1664525 + 1013904223) >>> 0;
    // Slight upward drift so most charts trend up like the mockups.
    value += (state / 2 ** 32 - 0.4) * 10;
    series.push(value);
  }
  return series;
}
