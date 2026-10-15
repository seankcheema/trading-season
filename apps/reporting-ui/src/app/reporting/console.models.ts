// Response shapes of the Reporting Service's console endpoints. The canonical
// contract is apps/reporting-service/openapi.yaml; keep these in step with it.

// all starts on the day of the first order or cash transfer.
export type ActivityRange = 'today' | '7d' | '30d' | '90d' | 'all';
export type OrderStatus = 'FILLED' | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
export type OrderSide = 'BUY' | 'SELL';
export type TraderLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

// A figure with its change against the period before, in percent; null when
// that period has nothing to compare with, as it always is for all time.
export interface Compared {
  value: number;
  change: number | null;
}

export interface ActivityKpis {
  orders: Compared;
  // value is null when no order has resolved; change is in percentage points.
  fillRate: { value: number | null; change: number | null; filled: number };
  rejected: { value: number; topReason: string | null; topReasonCount: number };
  netCashFlow: Compared;
  activeTraders: Compared;
}

export interface NotionalPoint {
  // Start of the hour or day the value covers. All time covers a span of days
  // per point once it reaches back more than 366 days.
  at: string;
  value: number;
}

export interface StatusCount {
  status: OrderStatus;
  count: number;
}

// What the traders of one level did in the range. A level is the product's client segment.
export interface SegmentActivity {
  segment: TraderLevel;
  // Traders of the level who placed at least one order.
  traders: number;
  orders: number;
  notional: number;
}

export type FeedItem =
  | { kind: 'fill'; at: string; userName: string; side: OrderSide; quantity: number; symbol: string; amount: number }
  | { kind: 'reject'; at: string; orderId: number; reason: string | null; symbol: string }
  | { kind: 'cash'; at: string; userName: string; reason: 'DEPOSIT' | 'WITHDRAWAL'; amount: number }
  | { kind: 'lock'; at: string; userName: string; failedAttempts: number };

export interface TradedSymbol {
  symbol: string;
  orders: number;
  notional: number;
  // Fill prices in the order they happened.
  prices: number[];
}

export interface Activity {
  range: ActivityRange;
  from: string;
  to: string;
  generatedAt: string;
  sessionId: number | null;
  kpis: ActivityKpis;
  notional: { total: number; change: number | null; points: NotionalPoint[] };
  statuses: StatusCount[];
  // One entry per trader level, lowest first.
  segments: SegmentActivity[];
  feed: FeedItem[];
  mostTraded: TradedSymbol[];
}

export interface OrderRow {
  orderId: number;
  clientReference: string;
  submittedAt: string;
  userId: string;
  userName: string;
  accountId: number;
  accountName: string;
  symbol: string;
  instrumentName: string;
  side: OrderSide;
  // Always MARKET: the product has no other kind of order.
  type: string;
  quantity: number;
  // The fill price; null until the order fills.
  price: number | null;
  indicativePrice: number | null;
  status: OrderStatus;
  rejectionReason: string | null;
}

export type TransferKind = 'DEPOSIT' | 'WITHDRAWAL';

// Cash a trader moved in or out themselves, as the cash ledger recorded it.
export interface TransferRow {
  // The cash transaction id.
  transferId: number;
  at: string;
  userId: string;
  userName: string;
  accountId: number;
  accountName: string;
  kind: TransferKind;
  // Signed: a withdrawal is negative.
  amount: number;
}

export interface OrderList {
  orders: OrderRow[];
  // The newest deposits and withdrawals, under the same limit as the orders.
  transfers: TransferRow[];
  // Every matching order, which can exceed the rows returned. Transfers are not counted.
  total: number;
  sessionId: number | null;
}

export interface OrderLedger {
  cashBefore: number;
  cashChange: number | null;
  cashAfter: number;
  holdingBefore: number;
  holdingChange: number | null;
  holdingAfter: number;
  cashTransactionId: number | null;
  holdingMovementId: number | null;
}

export interface AuditEvent {
  eventType: string;
  detail: string | null;
  recordedAt: string;
  // The price the order stood at when the entry was recorded: its fill price on
  // the entry that records the fill, the price it asked for on every other.
  // Null when the order carried no price.
  price: number | null;
  priceKind: 'INDICATIVE' | 'FILL' | null;
}

export interface OrderDetail extends OrderRow {
  executionType?: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT' | null;
  limitPrice?: number | null;
  stopPrice?: number | null;
  referencePrice?: number | null;
  referenceAt?: string | null;
  sessionId?: number | null;
  triggeredAt?: string | null;
  evaluatedAt?: string | null;
  reservedCash?: number | null;
  reservedShares?: number | null;
  executionPrice?: number | null;
  rejectionCode?: string | null;
  userEmail: string | null;
  bufferPercent: number | null;
  acceptedAt: string | null;
  resolvedAt: string | null;
  simulatedAt: string | null;
  fill: { fillId: number; price: number; quantity: number; filledAt: string } | null;
  ledger: OrderLedger;
  audit: AuditEvent[];
}

export type CustomerStatus = 'ACTIVE' | 'LOCKED';

// A trader. Analysts and admins are not customers and the service leaves them out.
export interface Customer {
  userId: string;
  name: string;
  email: string;
  // Always TRADER.
  role: string;
  status: CustomerStatus;
  // Null for a trader without a trading profile.
  traderLevel: string | null;
  accounts: number;
  cash: number;
  portfolio: number;
  failedAttempts: number;
  lockedUntil: string | null;
  lastActiveAt: string | null;
  memberSince: string;
}

export interface CustomerList {
  customers: Customer[];
}

export interface CustomerDetail extends Customer, OrderList {
  sessionTimeoutMinutes: number | null;
  accountBalances: { accountId: number; name: string; value: number }[];
}
