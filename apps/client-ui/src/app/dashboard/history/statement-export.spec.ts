import { HistoryRow } from '../shared/activity';
import {
  downloadStatement,
  statementCsv,
  statementFilename,
  statementPdf,
} from './statement-export';
import { vi } from 'vitest';

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

    it('falls back to the date as given when the time cannot be read', () => {
      const csv = statementCsv([row({ at: Number.NaN, date: 'sometime' })]);
      expect(csv).toContain('\r\nsometime,AAPL,');
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

    it('handles every kind of row, including a single one and an unreadable date', async () => {
      const deposit = row({ ...WITHDRAWAL, side: 'Deposit', positive: true, value: 500 });
      const rowsOfEachKind = [
        row({ executionType: 'LIMIT' }),
        row({ executionType: null, shares: null, price: null, at: Number.NaN }),
        deposit,
      ];
      for (const rows of [rowsOfEachKind, [row()]]) {
        const blob = await statementPdf(rows, new Date('2026-03-04T10:00:00Z'));
        expect(blob.size).toBeGreaterThan(0);
      }
    });
  });

  describe('downloadStatement', () => {
    afterEach(() => vi.restoreAllMocks());

    async function download(format: 'csv' | 'pdf'): Promise<{ blob: Blob; filename: string }> {
      let blob!: Blob;
      let filename = '';
      URL.createObjectURL = vi.fn((made: Blob) => {
        blob = made;
        return 'blob:statement';
      });
      URL.revokeObjectURL = vi.fn();
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        filename = this.download;
      });
      await downloadStatement(format, [row()], new Date('2026-03-04T10:00:00Z'));
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:statement');
      return { blob, filename };
    }

    it('saves a CSV with its filename', async () => {
      const { blob, filename } = await download('csv');
      expect(blob.type).toBe('text/csv;charset=utf-8');
      expect(filename).toBe('account-statement-2026-03-04.csv');
    });

    it('saves a PDF with its filename', async () => {
      const { blob, filename } = await download('pdf');
      expect(blob.type).toBe('application/pdf');
      expect(filename).toBe('account-statement-2026-03-04.pdf');
    });
  });
});
