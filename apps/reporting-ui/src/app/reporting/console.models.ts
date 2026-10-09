// Response shapes of the Reporting Service's analyst console endpoints. The canonical
// contract is apps/reporting-service/openapi.yaml; keep these in step with it.

export type ActivityRange = 'today' | '7d' | '30d' | '90d';
export type OrderStatus = 'FILLED' | 'PENDING' | 'ACCEPTED' | 'REJECTED';
export type OrderSide = 'BUY' | 'SELL';

// A figure with its change against the period before, in percent; null when
// that period has nothing to compare with.
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
  // Start of the hour or day the value covers.
  at: string;
  value: number;
}

export interface StatusCount {
  status: OrderStatus;
  count: number;
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

export interface OrderList {
  orders: OrderRow[];
  // Every matching order, which can exceed the rows returned.
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
}

export interface OrderDetail extends OrderRow {
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

export interface Customer {
  userId: string;
  name: string;
  email: string;
  role: string;
  status: CustomerStatus;
  // Null for a sign-in without a trading profile.
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
