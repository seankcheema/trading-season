import { Instrument } from '../mock-data';
import {
  AssetRow,
  PricedHolding,
  assetRows,
  matchesAssetFilter,
  matchesAssetQuery,
  sortAssetRows,
  summarizeAssets,
} from './assets';

function holding(
  symbol: string,
  shares: number,
  costBasis: number,
  price: number,
  changePercent = 1,
): PricedHolding {
  const instrument: Instrument = {
    symbol,
    name: `${symbol} Corp`,
    price,
    change: changePercent,
    changePercent,
  };
  const value = shares * price;
  return {
    symbol,
    shares,
    costBasis,
    instrument,
    value,
    gainLoss: value - shares * costBasis,
  };
}

const HOLDINGS = [
  holding('AAPL', 2, 100, 150, 2),
  holding('MSFT', 1, 300, 250, -1),
  holding('NVDA', 4, 50, 50, 0),
];

describe('assets', () => {
  describe('summarizeAssets', () => {
    it('totals market value, cost basis and unrealized gain across positions', () => {
      expect(summarizeAssets(HOLDINGS)).toEqual({
        marketValue: 750,
        costBasis: 700,
        unrealized: 50,
        positions: 3,
      });
    });

    it('is all zero for an empty portfolio', () => {
      expect(summarizeAssets([])).toEqual({
        marketValue: 0,
        costBasis: 0,
        unrealized: 0,
        positions: 0,
      });
    });
  });

  describe('assetRows', () => {
    it('derives price, return and weight for each position', () => {
      const [apple, microsoft] = assetRows(HOLDINGS);

      expect(apple).toMatchObject({
        symbol: 'AAPL',
        name: 'AAPL Corp',
        price: 150,
        changePercent: 2,
        value: 300,
        gainLoss: 100,
      });
      expect(apple.returnPercent).toBeCloseTo(50);
      expect(apple.weight).toBeCloseTo(40);
      expect(microsoft.returnPercent).toBeCloseTo(-16.667, 2);
      expect(microsoft.weight).toBeCloseTo(33.333, 2);
    });

    it('weights add up to one hundred percent', () => {
      const total = assetRows(HOLDINGS).reduce((sum, row) => sum + row.weight, 0);
      expect(total).toBeCloseTo(100);
    });

    it('reports a zero return when there is no cost basis and a zero weight when worthless', () => {
      const [free] = assetRows([holding('FREE', 3, 0, 10)]);
      expect(free.returnPercent).toBe(0);

      const [worthless] = assetRows([holding('ZERO', 3, 5, 0)]);
      expect(worthless.weight).toBe(0);
    });
  });

  describe('filters', () => {
    const rows = assetRows(HOLDINGS);
    const symbols = (filter: Parameters<typeof matchesAssetFilter>[1]) =>
      rows.filter((row) => matchesAssetFilter(row, filter)).map((row) => row.symbol);

    it('splits winners from losers and leaves break-even in neither', () => {
      expect(symbols('all')).toEqual(['AAPL', 'MSFT', 'NVDA']);
      expect(symbols('gainers')).toEqual(['AAPL']);
      expect(symbols('losers')).toEqual(['MSFT']);
    });

    it('matches the query against symbol and name, ignoring case and padding', () => {
      const [apple] = rows;
      expect(matchesAssetQuery(apple, '')).toBe(true);
      expect(matchesAssetQuery(apple, '   ')).toBe(true);
      expect(matchesAssetQuery(apple, ' aap ')).toBe(true);
      expect(matchesAssetQuery(apple, 'corp')).toBe(true);
      expect(matchesAssetQuery(apple, 'zzz')).toBe(false);
    });
  });

  describe('sortAssetRows', () => {
    const rows = assetRows(HOLDINGS);
    const order = (key: Parameters<typeof sortAssetRows>[1], direction: 'asc' | 'desc') =>
      sortAssetRows(rows, key, direction).map((row) => row.symbol);

    it('sorts numbers in both directions', () => {
      expect(order('value', 'desc')).toEqual(['AAPL', 'MSFT', 'NVDA']);
      expect(order('value', 'asc')).toEqual(['NVDA', 'MSFT', 'AAPL']);
      expect(order('returnPercent', 'asc')).toEqual(['MSFT', 'NVDA', 'AAPL']);
    });

    it('sorts text alphabetically', () => {
      expect(order('symbol', 'asc')).toEqual(['AAPL', 'MSFT', 'NVDA']);
      expect(order('symbol', 'desc')).toEqual(['NVDA', 'MSFT', 'AAPL']);
    });

    it('breaks ties by ticker whatever the direction', () => {
      const tied: AssetRow[] = assetRows([holding('ZZZ', 1, 1, 10), holding('AAA', 1, 1, 10)]);
      expect(sortAssetRows(tied, 'value', 'desc').map((row) => row.symbol)).toEqual(['AAA', 'ZZZ']);
      expect(sortAssetRows(tied, 'value', 'asc').map((row) => row.symbol)).toEqual(['AAA', 'ZZZ']);
    });

    it('sorts a copy and leaves the input alone', () => {
      sortAssetRows(rows, 'value', 'asc');
      expect(rows.map((row) => row.symbol)).toEqual(['AAPL', 'MSFT', 'NVDA']);
    });
  });
});
