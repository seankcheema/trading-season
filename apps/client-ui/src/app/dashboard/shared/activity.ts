import { CashTransaction } from '../accounts/account.models';
import { InstrumentRef, OrderResult } from '../orders/order.models';
import { ActivityItem, ActivityStatus } from './activity-row.component';

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

// When an order took effect: the selected replay time, else when the backend resolved it, else
// (for an order still pending) when it was submitted.
export function orderDate(order: OrderResult): string {
  if (order.simulatedAt && Number.isFinite(Date.parse(order.simulatedAt))) {
    return order.simulatedAt;
  }
  return order.resolvedAt ?? order.submittedAt;
}

// The stock an order trades, or its number when the catalogue has not loaded or lacks it.
export function orderSymbol(order: OrderResult, catalogue: readonly InstrumentRef[]): string {
  const instrument =
    order.instrumentId === undefined
      ? undefined
      : catalogue.find((ref) => ref.instrumentId === order.instrumentId);
  return instrument?.simulatedStockSymbol ?? instrument?.ticker ?? `Order #${order.orderId}`;
}

export function orderActivity(
  order: OrderResult,
  catalogue: readonly InstrumentRef[],
): ActivityItem {
  return {
    kind: 'trade',
    key: `order-${order.orderId}`,
    date: orderDate(order),
    value: order.quantity * order.indicativePrice,
    label: orderSymbol(order, catalogue),
    detail: `${order.quantity} @ ${USD.format(order.indicativePrice)}`,
    type: order.orderType,
    status: order.status,
    positive: order.orderType === 'SELL',
    rejectionReason: order.rejectionReason,
  };
}

export function cashActivity(transaction: CashTransaction): ActivityItem {
  return {
    kind: 'cash',
    key: `cash-${transaction.cashTransactionId}`,
    date: transaction.createdAt,
    value: transaction.amount,
    label: 'Cash',
    detail: '',
    type: transaction.reason,
    status: 'COMPLETED',
    positive: transaction.reason === 'DEPOSIT',
  };
}

// One line of a full history table, which shows more than the dashboard's compact rows do.
export interface HistoryRow {
  key: string;
  kind: 'cash' | 'trade';
  // Milliseconds since the epoch, for sorting and for the replay cursor.
  at: number;
  date: string;
  // The stock traded, or null for cash and for an order whose instrument is not in the catalogue.
  symbol: string | null;
  label: string;
  account: string;
  status: ActivityStatus;
  // Buy or sell for an order, deposit or withdrawal for cash.
  side: 'Buy' | 'Sell' | 'Deposit' | 'Withdrawal';
  shares: number | null;
  price: number | null;
  value: number;
  positive: boolean;
  rejectionReason: string | null;
}

export type HistorySortKey =
  'date' | 'account' | 'label' | 'status' | 'side' | 'shares' | 'price' | 'value';
export type SortDirection = 'asc' | 'desc';

export function orderHistoryRow(
  order: OrderResult,
  catalogue: readonly InstrumentRef[],
  accountName: string,
): HistoryRow {
  const item = orderActivity(order, catalogue);
  const instrument = catalogue.find((ref) => ref.instrumentId === order.instrumentId);
  return {
    key: item.key,
    kind: 'trade',
    at: Date.parse(item.date),
    date: item.date,
    symbol: instrument ? (instrument.simulatedStockSymbol ?? instrument.ticker) : null,
    label: item.label,
    account: accountName,
    status: order.status,
    side: order.orderType === 'BUY' ? 'Buy' : 'Sell',
    shares: order.quantity,
    price: order.indicativePrice,
    value: item.value,
    positive: item.positive,
    rejectionReason: order.rejectionReason,
  };
}

export function cashHistoryRow(transaction: CashTransaction): HistoryRow {
  const item = cashActivity(transaction);
  return {
    key: item.key,
    kind: 'cash',
    at: Date.parse(item.date),
    date: item.date,
    symbol: null,
    label: item.label,
    account: 'All accounts',
    status: item.status,
    side: transaction.reason === 'DEPOSIT' ? 'Deposit' : 'Withdrawal',
    shares: null,
    price: null,
    value: item.value,
    positive: item.positive,
    rejectionReason: null,
  };
}

// Sorts a copy. Rows without a value for the column (cash has no shares) always sort last,
// and ties fall back to newest first so the order is stable.
export function sortHistoryRows(
  rows: readonly HistoryRow[],
  key: HistorySortKey,
  direction: SortDirection,
): HistoryRow[] {
  const sign = direction === 'asc' ? 1 : -1;
  const valueOf = (row: HistoryRow): string | number | null => (key === 'date' ? row.at : row[key]);
  return [...rows].sort((a, b) => {
    const x = valueOf(a);
    const y = valueOf(b);
    if (x === y) return b.at - a.at || b.key.localeCompare(a.key);
    if (x === null) return 1;
    if (y === null) return -1;
    return (typeof x === 'string' ? x.localeCompare(y as string) : x - (y as number)) * sign;
  });
}
