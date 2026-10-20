import { ExecutionType } from '../orders/order.models';
import { HistoryRow } from '../shared/activity';

export type StatementFormat = 'csv' | 'pdf';

const HEADERS = [
  'Date',
  'Asset',
  'Account',
  'Type',
  'Order kind',
  'Status',
  'Shares',
  'Price',
  'Value (USD)',
] as const;

const EXECUTION_LABELS: Record<ExecutionType, string> = {
  MARKET: 'Market',
  LIMIT: 'Limit',
  STOP: 'Stop',
  STOP_LIMIT: 'Stop-limit',
};

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

// Cash transfers carry a +/- sign; a trade's value is its plain notional amount.
function signedValue(row: HistoryRow): number {
  if (row.kind !== 'cash') {
    return row.value;
  }
  return row.positive ? row.value : -row.value;
}

function isoDate(row: HistoryRow): string {
  return Number.isFinite(row.at) ? new Date(row.at).toISOString() : row.date;
}

// A text cell starting with one of these is read as a formula by spreadsheet programs, so the
// asset or account name could run code when the statement is opened there.
const FORMULA_START = /^[=+\-@\t\r]/;

function csvCell(value: string | number | null): string {
  if (value === null) {
    return '';
  }
  let text = String(value);
  if (typeof value === 'string' && FORMULA_START.test(text)) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvFields(row: HistoryRow): (string | number | null)[] {
  return [
    isoDate(row),
    row.label,
    row.account,
    row.side,
    row.executionType ? EXECUTION_LABELS[row.executionType] : null,
    row.status,
    row.shares,
    row.price,
    signedValue(row),
  ];
}

// Plain numbers and ISO dates, so a spreadsheet can sort and total them. The byte order mark
// makes Excel read the file as UTF-8.
export function statementCsv(rows: readonly HistoryRow[]): string {
  const lines = [HEADERS.map(csvCell), ...rows.map((row) => csvFields(row).map(csvCell))];
  return `﻿${lines.map((line) => line.join(',')).join('\r\n')}\r\n`;
}

function pdfFields(row: HistoryRow): string[] {
  const value = signedValue(row);
  return [
    isoDate(row).replace('T', ' ').replace(/\.\d+Z$/, ' UTC'),
    row.label,
    row.account,
    row.side + (row.executionType && row.executionType !== 'MARKET' ? ` (${EXECUTION_LABELS[row.executionType]})` : ''),
    row.status,
    row.shares === null ? '-' : String(row.shares),
    row.price === null ? '-' : USD.format(row.price),
    `${value < 0 ? '-' : row.kind === 'cash' ? '+' : ''}${USD.format(Math.abs(value))}`,
  ];
}

// jsPDF is large, so it loads only when someone asks for a PDF.
export async function statementPdf(rows: readonly HistoryRow[], generatedAt: Date): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFontSize(16);
  doc.text('Account statement', 40, 40);
  doc.setFontSize(9);
  doc.text(
    `Generated ${generatedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC - ${rows.length} ${rows.length === 1 ? 'transaction' : 'transactions'}`,
    40,
    56,
  );
  autoTable(doc, {
    startY: 70,
    head: [['Date', 'Asset', 'Account', 'Type', 'Status', 'Shares', 'Price', 'Value']],
    body: rows.map(pdfFields),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [40, 40, 40] },
    columnStyles: { 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
  });
  return doc.output('blob');
}

export function statementFilename(format: StatementFormat, generatedAt: Date): string {
  return `account-statement-${generatedAt.toISOString().slice(0, 10)}.${format}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadStatement(
  format: StatementFormat,
  rows: readonly HistoryRow[],
  generatedAt = new Date(),
): Promise<void> {
  const blob =
    format === 'csv'
      ? new Blob([statementCsv(rows)], { type: 'text/csv;charset=utf-8' })
      : await statementPdf(rows, generatedAt);
  downloadBlob(blob, statementFilename(format, generatedAt));
}
