import { MOCK_INSTRUMENTS, findInstrument, mockPriceSeries, searchInstruments } from './mock-data';

const DAY = 24 * 60 * 60_000;

describe('mock-data', () => {
  describe('findInstrument', () => {
    it('finds a symbol in the built-in list or in one supplied', () => {
      expect(findInstrument('AAPL')?.name).toBe('Apple Inc.');
      expect(findInstrument('NOPE')).toBeUndefined();
      const custom = [{ symbol: 'ZZZ', name: 'Z', price: 1, change: 0, changePercent: 0 }];
      expect(findInstrument('ZZZ', custom)).toBe(custom[0]);
    });
  });

  describe('searchInstruments', () => {
    it('matches symbol or name, ignoring case, and nothing for a blank query', () => {
      expect(searchInstruments('')).toEqual([]);
      expect(searchInstruments('   ')).toEqual([]);
      expect(searchInstruments('nvda').map((i) => i.symbol)).toEqual(['NVDA']);
      expect(searchInstruments('micro').map((i) => i.symbol)).toEqual(['MSFT']);
      expect(searchInstruments('a', MOCK_INSTRUMENTS.slice(0, 1))).toHaveLength(1);
    });
  });

  describe('mockPriceSeries', () => {
    it('ends at the requested value and is repeatable', () => {
      const first = mockPriceSeries('AAPL', '1M', 123.45);
      const again = mockPriceSeries('AAPL', '1M', 123.45);
      expect(first.at(-1)!.value).toBeCloseTo(123.45);
      expect(again).toEqual(first);
      expect(mockPriceSeries('MSFT', '1M', 123.45)).not.toEqual(first);
    });

    it('is ordered oldest first at each timeframe', () => {
      for (const timeframe of ['1D', '5D', '1M', '1Y'] as const) {
        const series = mockPriceSeries('AAPL', timeframe, 100);
        const times = series.map((point) => point.time.getTime());
        expect(times).toEqual([...times].sort((a, b) => a - b));
        expect(series.length).toBeGreaterThan(1);
      }
    });

    it('covers a regular session of fifteen minute bars by default', () => {
      expect(mockPriceSeries('AAPL', '1D', 100)).toHaveLength(27);
    });

    it('keeps only weekdays for a month and spans a year weekly', () => {
      const month = mockPriceSeries('AAPL', '1M', 100);
      expect(month.every((point) => ![0, 6].includes(point.time.getUTCDay()))).toBe(true);
      expect(mockPriceSeries('AAPL', '5D', 100)).toHaveLength(35);
      const year = mockPriceSeries('AAPL', '1Y', 100);
      expect(year).toHaveLength(53);
      expect(year[1].time.getTime() - year[0].time.getTime()).toBe(7 * DAY);
    });

    it('builds an intraday series up to the replay cursor, ending exactly on it', () => {
      // 10:07am Chicago time on 2026-01-05, between two fifteen minute samples.
      const cursor = Date.parse('2026-01-05T16:07:00Z');
      const series = mockPriceSeries('AAPL', '1D', 100, cursor);

      expect(series[0].time.toISOString()).toBe('2026-01-05T15:30:00.000Z');
      expect(series.at(-1)!.time.getTime()).toBe(cursor);
      expect(series.at(-1)!.value).toBeCloseTo(100);
      expect(series).toHaveLength(4);
    });

    it('does not repeat the cursor when it lands on a sample', () => {
      const cursor = Date.parse('2026-01-05T15:45:00Z');
      const times = mockPriceSeries('AAPL', '1D', 100, cursor).map((point) => point.time.getTime());
      expect(times).toEqual([Date.parse('2026-01-05T15:30:00Z'), cursor]);
    });

    it('holds a single point when the cursor is before the open', () => {
      const cursor = Date.parse('2026-01-05T14:00:00Z');
      const series = mockPriceSeries('AAPL', '1D', 100, cursor);
      expect(series).toHaveLength(1);
      expect(series[0].time.getTime()).toBe(cursor);
    });
  });
});
