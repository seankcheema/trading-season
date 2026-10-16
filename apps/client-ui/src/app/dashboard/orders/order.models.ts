// Shapes of the Order and Sell Service's trading endpoints; see apps/order-and-sell-service/README.md.
//
// An order is placed against an instrumentId, but a trader picks a symbol and market data is
// keyed by symbol, so GET /api/instruments is the lookup between the two.

export type OrderType = 'BUY' | 'SELL';

// PENDING is never the status of a submission's response: an order is ACCEPTED or REJECTED
// before the request returns, and an accepted order is normally FILLED in the same request.
// A response is ACCEPTED only when execution failed and the order stays on record (BR-06).
// PENDING can still appear in order history.
export type OrderStatus = 'PENDING' | 'ACCEPTED' | 'FILLED' | 'REJECTED';

// One `order-status` frame on GET /api/orders/stream: the body of a trade event, pushed the
// moment the Order and Sell Service commits a status change (BR-07). Only the fields the client
// applies are typed; see apps/order-and-sell-service/README.md for the full shape.
export interface OrderStatusFrame {
  orderId: number;
  status: OrderStatus;
  rejectionReason: string | null;
  order?: {
    resolvedAt?: string | null;
  };
}

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
  accountId: number;
  instrumentId: number;
  orderType: OrderType;
  quantity: number;
  // The price shown to the trader before they submitted (BR-13). Execution fills at the
  // current market quote and reports that as fillPrice (BR-08).
  indicativePrice: number;
  // Idempotency key. Resubmitting it returns the original order's outcome.
  clientReference: string;
}

export interface OrderResult {
  simulatedAt?: string | null;
  orderId: number;
  // Optional during rollout against an older backend; identifies the catalogue entry.
  instrumentId?: number;
  accountId?: number;
  status: OrderStatus;
  orderType: OrderType;
  quantity: number;
  indicativePrice: number;
  // The market price the order filled at (BR-08). Set on the response to a FILLED
  // submission; absent from listings and from older backends.
  fillPrice?: number | null;
  // Set only when the status is REJECTED.
  rejectionReason: string | null;
  submittedAt: string;
  resolvedAt: string | null;
}

/** One immutable lifecycle event from GET /api/orders/{orderId}/audit. */
export interface OrderAuditEntry {
  eventType: string;
  price: number;
  occurredAt: string;
  detail: string | null;
}
