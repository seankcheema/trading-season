import { HistoryRow } from '../shared/activity';
import { statementCsv, statementFilename, statementPdf } from './statement-export';

function row(overrides: Partial<HistoryRow> = {}): HistoryRow {
  return {
    key: 'order-1',
    kind: 'trade',
    at: Date.parse('2026-01-05T16:00:00Z'),
    date: '2026-01-05T16:00:00Z',
    symbol: 'AAPL',
    label: 'AAPL',
    account: 'Trading',
    accountId: 1,
    executionType: 'MARKET',
    status: 'FILLED',
    side: 'Buy',
    shares: 2,
    price: 100,
    value: 200,
    positive: false,
    rejectionReason: null,
    orderId: 1,
    ...overrides,
  };
}

const WITHDRAWAL = row({
  key: 'cash-2',
  kind: 'cash',
  label: 'Withdrawal',
  account: 'All accounts',
  accountId: null,
  executionType: null,
  status: 'COMPLETED',
  side: 'Withdrawal',
  shares: null,
  price: null,
  value: 50,
  positive: false,
  orderId: null,
});

describe('statement export', () => {
  describe('statementCsv', () => {
    it('writes a header and one line per row with ISO dates and plain numbers', () => {
      const lines = statementCsv([row(), WITHDRAWAL]).replace('﻿', '').split('\r\n');
      expect(lines[0]).toBe('Date,Asset,Account,Type,Order kind,Status,Shares,Price,Value (USD)');
      expect(lines[1]).toBe('2026-01-05T16:00:00.000Z,AAPL,Trading,Buy,Market,FILLED,2,100,200');
      expect(lines[2]).toBe(
        '2026-01-05T16:00:00.000Z,Withdrawal,All accounts,Withdrawal,,COMPLETED,,,-50',
      );
    });

    it('signs cash deposits and withdrawals but not trades', () => {
      const deposit = row({ ...WITHDRAWAL, side: 'Deposit', positive: true, value: 500 });
      const lines = statementCsv([deposit]).split('\r\n');
      expect(lines[1].endsWith(',500')).toBe(true);
    });

    it('quotes cells holding commas, quotes or line breaks', () => {
      const csv = statementCsv([row({ label: 'A, "B"\nC' })]);
      expect(csv).toContain('"A, ""B""\nC"');
    });

    it('defuses text a spreadsheet would run as a formula', () => {
      const csv = statementCsv([row({ label: '=HYPERLINK("x")', account: '@sum' })]);
      expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
      expect(csv).toContain(",'@sum,");
    });

    it('is just the header for no rows', () => {
      expect(statementCsv([]).replace('﻿', '').split('\r\n').filter(Boolean)).toHaveLength(1);
    });
  });

  describe('statementFilename', () => {
    it('names the file after the day it was generated', () => {
      const day = new Date('2026-03-04T10:00:00Z');
      expect(statementFilename('csv', day)).toBe('account-statement-2026-03-04.csv');
      expect(statementFilename('pdf', day)).toBe('account-statement-2026-03-04.pdf');
    });
  });

  describe('statementPdf', () => {
    it('produces a PDF document', async () => {
      const blob = await statementPdf([row(), WITHDRAWAL], new Date('2026-03-04T10:00:00Z'));
      expect(blob.type).toBe('application/pdf');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    });
  });
});
