// Shapes of the Order and Sell Service's trading endpoints; see apps/order-and-sell-service/README.md.
//
// An order is placed against an instrumentId, but a trader picks a symbol and market data is
// keyed by symbol, so GET /api/instruments is the lookup between the two.

export type OrderType = 'BUY' | 'SELL';

// PENDING is never the status of a submission's response: an order reaches FILLED or REJECTED
// before the request returns. It can still appear in order history.
export type OrderStatus = 'PENDING' | 'FILLED' | 'REJECTED';

export interface InstrumentRef {
  instrumentId: number;
  // The instrument's own symbol.
  ticker: string;
  name: string;
  assetClass: string;
  // Null for FX and crypto.
  market: string | null;
  currency: string;
  // False means an order against it is rejected (BR-05).
  tradable: boolean;
  // The market-data symbol quoting it, or null when nothing simulates it. This, not the
  // ticker, is what GET /api/market/snapshot reports.
  simulatedStockSymbol: string | null;
}

export interface OrderSubmission {
  simulatedAt?: string;
  sessionId?: number;
  bufferPercent?: number;
  accountId: number;
  instrumentId: number;
  orderType: OrderType;
  quantity: number;
  // The displayed reference price; execution uses the server replay quote.
  indicativePrice: number;
  // Idempotency key. Resubmitting it returns the original order's outcome.
  clientReference: string;
}

export interface OrderCheckResult {
  eligible: boolean;
  rejectionCode: string | null;
  rejectionReason: string | null;
  bufferPercent: number;
  indicativePrice: number;
  executionPrice: number | null;
  estimatedTradeValue: number | null;
  priceBoundary: number | null;
  sessionId: number | null;
  quoteTimestamp: string | null;
}

export interface OrderResult {
  bufferPercent?: number;
  executionPrice?: number | null;
  executedSimulatedAt?: string | null;
  simulatedAt?: string | null;
  orderId: number;
  // Optional during rollout against an older backend; identifies the catalogue entry.
  instrumentId?: number;
  accountId?: number;
  status: OrderStatus;
  orderType: OrderType;
  quantity: number;
  indicativePrice: number;
  // Set only when the status is REJECTED.
  rejectionReason: string | null;
  submittedAt: string;
  resolvedAt: string | null;
}
