import { OrderRow, OrderSide, OrderStatus, TransferKind, TransferRow } from '../reporting/console.models';

// What a transfer is filed under in the asset column and filter.
export const CASH = 'Cash';
// A transfer is in the ledger only once it has gone through.
export const TRANSFER_STATUS = 'COMPLETED';

// One line of an orders table: an order, or a deposit or withdrawal of cash.
export interface LedgerRow {
  // Unique across both kinds, since the two id sequences overlap.
  key: string;
  // The order behind the row; null for a transfer, which opens nothing.
  order: OrderRow | null;
  // The order id, or the cash transaction id of a transfer.
  id: number;
  at: string;
  userName: string;
  accountName: string;
  // The ticker, or Cash for a transfer.
  symbol: string;
  side: OrderSide | TransferKind;
  // Shares; null for a transfer.
  quantity: number | null;
  // The fill price; null for a transfer and until an order fills.
  price: number | null;
  // What moved, unsigned: shares at the fill price, or the cash transferred.
  // Null until an order fills.
  amount: number | null;
  status: OrderStatus | typeof TRANSFER_STATUS;
  // The order's client reference; empty for a transfer.
  reference: string;
}

export type LedgerSortKey =
  | 'id'
  | 'time'
  | 'user'
  | 'account'
  | 'symbol'
  | 'side'
  | 'quantity'
  | 'price'
  | 'amount'
  | 'status';

function orderLine(order: OrderRow): LedgerRow {
  return {
    key: `order-${order.orderId}`,
    order,
    id: order.orderId,
    at: order.submittedAt,
    userName: order.userName,
    accountName: order.accountName,
    symbol: order.symbol,
    side: order.side,
    quantity: order.quantity,
    price: order.price,
    // To the cent, as the cash ledger posts it.
    amount: order.price === null ? null : Math.round(order.quantity * order.price * 100) / 100,
    status: order.status,
    reference: order.clientReference,
  };
}

function transferLine(transfer: TransferRow): LedgerRow {
  return {
    key: `transfer-${transfer.transferId}`,
    order: null,
    id: transfer.transferId,
    at: transfer.at,
    userName: transfer.userName,
    accountName: transfer.accountName,
    symbol: CASH,
    side: transfer.kind,
    quantity: null,
    price: null,
    amount: Math.abs(transfer.amount),
    status: TRANSFER_STATUS,
    reference: '',
  };
}

// Orders and transfers as the lines of one table.
export function ledgerRows(
  orders: readonly OrderRow[],
  transfers: readonly TransferRow[],
): LedgerRow[] {
  return [...orders.map(orderLine), ...transfers.map(transferLine)];
}

// What a column sorts on. Orders and transfers number themselves separately, so
// time is the timestamp, and the order column leaves transfers at the far end.
export function ledgerSortValue(row: LedgerRow, key: LedgerSortKey): string | number {
  switch (key) {
    case 'id':
      return row.order ? row.id : 0;
    case 'time':
      return new Date(row.at).getTime();
    case 'user':
      return row.userName;
    case 'account':
      return row.accountName;
    case 'quantity':
    case 'price':
    case 'amount':
      return row[key] ?? 0;
    default:
      return row[key];
  }
}
