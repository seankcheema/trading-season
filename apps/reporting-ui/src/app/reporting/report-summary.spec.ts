import { report } from '../../testing/fixtures';
import { SortState, sortRows, summarize, toNumber, toggleSort } from './report-summary';

describe('summarize', () => {
  it('derives the headline figures from a report', () => {
    expect(summarize(report())).toEqual({
      resolved: 8,
      filled: 6,
      rejected: 2,
      fillRate: 75,
      rejectedRate: 25,
      notional: 4619.25 + 1424.66,
      shares: 29.5,
      symbols: 2,
      accounts: 2,
    });
  });

  it('has no rates before any order resolves', () => {
    const summary = summarize(
      report({
        statusCounts: { FILLED: 0, REJECTED: 0 },
        volumeBySymbol: [],
        tradesPerAccount: [],
        dailyCounts: [],
      }),
    );
    expect(summary).toMatchObject({
      resolved: 0,
      fillRate: null,
      rejectedRate: null,
      notional: 0,
      symbols: 0,
    });
  });
});

describe('toNumber', () => {
  it('reads decimal strings and treats anything else as zero', () => {
    expect(toNumber('4619.25')).toBe(4619.25);
    expect(toNumber(3)).toBe(3);
    expect(toNumber('n/a')).toBe(0);
    expect(toNumber(undefined)).toBe(0);
  });
});

describe('sorting', () => {
  type Key = 'name' | 'value';
  const rows = [
    { name: 'b', value: 2 },
    { name: 'a', value: 3 },
    { name: 'c', value: 1 },
  ];
  const value = (row: (typeof rows)[number], key: Key) => row[key];

  it('sorts numbers and text in either direction without changing the input', () => {
    expect(sortRows(rows, { key: 'value', direction: 'desc' }, value).map((r) => r.value)).toEqual([
      3, 2, 1,
    ]);
    expect(sortRows(rows, { key: 'name', direction: 'asc' }, value).map((r) => r.name)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(rows[0].name).toBe('b');
  });

  it('sorts a new column descending and flips the same column', () => {
    const start: SortState<Key> = { key: 'value', direction: 'desc' };
    expect(toggleSort(start, 'value')).toEqual({ key: 'value', direction: 'asc' });
    expect(toggleSort({ key: 'value', direction: 'asc' }, 'value')).toEqual(start);
    expect(toggleSort(start, 'name')).toEqual({ key: 'name', direction: 'desc' });
  });
});
