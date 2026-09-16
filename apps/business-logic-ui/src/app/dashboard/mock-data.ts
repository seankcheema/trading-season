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

export function findInstrument(
  symbol: string,
  instruments: readonly Instrument[] = MOCK_INSTRUMENTS,
): Instrument | undefined {
  return instruments.find((instrument) => instrument.symbol === symbol);
}

export function searchInstruments(
  query: string,
  instruments: readonly Instrument[] = MOCK_INSTRUMENTS,
): Instrument[] {
  const term = query.trim().toLowerCase();
  if (!term) {
    return [];
  }
  return instruments.filter(
    (instrument) =>
      instrument.symbol.toLowerCase().includes(term) || instrument.name.toLowerCase().includes(term),
  );
}

export interface PricePoint {
  time: Date;
  value: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Fixed "latest market close" rather than `new Date()`, so prerendered HTML matches what the
// client hydrates. Times are market wall-clock values stored as UTC; format them with the
// 'UTC' timezone to display them as-is.
const MOCK_LAST_CLOSE = Date.UTC(2026, 8, 14, 16, 0);

// `count` timestamps ending at `end`, `step` ms apart, oldest first.
function steps(end: number, step: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => end - (count - 1 - i) * step);
}

// Closing times of the weekdays within the last `calendarDays` days, oldest first.
function tradingDayCloses(calendarDays: number): number[] {
  return steps(MOCK_LAST_CLOSE, DAY, calendarDays).filter((time) => {
    const weekday = new Date(time).getUTCDay();
    return weekday !== 0 && weekday !== 6;
  });
}

function mockTimestamps(timeframe: Timeframe): number[] {
  switch (timeframe) {
    case '1D':
      // 9:30am to 4:00pm in 15 minute bars.
      return steps(MOCK_LAST_CLOSE, 15 * MINUTE, 27);
    case '5D':
      return tradingDayCloses(7)
        .slice(-5)
        .flatMap((close) => steps(close, HOUR, 7));
    case '1W':
      return tradingDayCloses(7).flatMap((close) => steps(close, 30 * MINUTE, 14));
    case '1M':
      return tradingDayCloses(30);
    case '1Y':
      return steps(MOCK_LAST_CLOSE, 7 * DAY, 53);
  }
}

// Deterministic fake price history ending at `endValue`, so charts look stable across renders
// (and SSR/hydration).
export function mockPriceSeries(
  seed: string,
  timeframe: Timeframe,
  endValue: number,
  endTime = MOCK_LAST_CLOSE,
): PricePoint[] {
  const timestamps = mockTimestamps(timeframe);
  const offset = endTime - timestamps[timestamps.length - 1];
  const shiftedTimestamps = timestamps.map((time) => time + offset);

  let state = 0;
  for (const char of seed + timeframe) {
    state = (state * 31 + char.charCodeAt(0)) >>> 0;
  }

  const walk: number[] = [];
  let value = 100;
  for (let i = 0; i < timestamps.length; i++) {
    state = (state * 1664525 + 1013904223) >>> 0;
    // Slight upward drift so most charts trend up like the mockups; scaled by length so
    // denser series swing about as much as sparse ones.
    value += ((state / 2 ** 32 - 0.45) * 20) / Math.sqrt(timestamps.length);
    walk.push(value);
  }

  const scale = endValue / walk[walk.length - 1];
  return shiftedTimestamps.map((time, i) => ({ time: new Date(time), value: walk[i] * scale }));
}
