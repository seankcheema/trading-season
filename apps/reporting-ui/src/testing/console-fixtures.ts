import {
  Activity,
  Customer,
  CustomerDetail,
  OrderDetail,
  OrderRow,
  TransferRow,
} from '../app/reporting/console.models';

// Test data shaped like the Reporting Service's console responses. Not part of
// the application build.

export function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    range: 'today',
    from: '2026-10-08T05:00:00+00:00',
    to: '2026-10-08T20:45:00+00:00',
    generatedAt: '2026-10-08T20:45:00+00:00',
    sessionId: 12,
    kpis: {
      orders: { value: 1424, change: 8.4 },
      fillRate: { value: 90.2, change: -1.1, filled: 1284 },
      rejected: {
        value: 67,
        topReason: 'BR-09: insufficient funds for this order',
        topReasonCount: 41,
      },
      netCashFlow: { value: 84210, change: 3.2 },
      activeTraders: { value: 312, change: null },
    },
    notional: {
      total: 6043.5,
      change: 8.4,
      points: [
        { at: '2026-10-08T13:00:00+00:00', value: 1000 },
        { at: '2026-10-08T14:00:00+00:00', value: 3000 },
        { at: '2026-10-08T15:00:00+00:00', value: 2043.5 },
      ],
    },
    statuses: [
      { status: 'FILLED', count: 6 },
      { status: 'PENDING', count: 1 },
      { status: 'ACCEPTED', count: 1 },
      { status: 'REJECTED', count: 2 },
    ],
    segments: [
      { segment: 'BEGINNER', traders: 120, orders: 310, notional: 1208.7 },
      { segment: 'INTERMEDIATE', traders: 1, orders: 1, notional: 0 },
      { segment: 'ADVANCED', traders: 52, orders: 714, notional: 4834.8 },
    ],
    feed: [
      {
        kind: 'fill',
        at: '2026-10-08T20:44:00+00:00',
        userName: 'Sean Cheema',
        side: 'BUY',
        quantity: 4,
        symbol: 'AAPL',
        amount: 1266.36,
      },
      {
        kind: 'fill',
        at: '2026-10-08T20:43:00+00:00',
        userName: 'Priya Natarajan',
        side: 'SELL',
        quantity: 25,
        symbol: 'NVDA',
        amount: 4619.25,
      },
      {
        kind: 'reject',
        at: '2026-10-08T20:42:00+00:00',
        orderId: 10480,
        reason: 'BR-09: insufficient funds for this order',
        symbol: 'TSLA',
      },
      { kind: 'reject', at: '2026-10-08T20:41:00+00:00', orderId: 10479, reason: null, symbol: 'SPY' },
      {
        kind: 'cash',
        at: '2026-10-08T20:40:00+00:00',
        userName: 'Marcus Lee',
        reason: 'DEPOSIT',
        amount: 2500,
      },
      {
        kind: 'cash',
        at: '2026-10-08T20:12:00+00:00',
        userName: 'Priya Natarajan',
        reason: 'WITHDRAWAL',
        amount: -800,
      },
      { kind: 'lock', at: '2026-10-08T20:30:00+00:00', userName: 'Jane Doe', failedAttempts: 5 },
    ],
    mostTraded: [
      { symbol: 'NVDA', orders: 312, notional: 1840220, prices: [180, 184.77] },
      { symbol: 'AAPL', orders: 268, notional: 1210450, prices: [320, 316.59] },
    ],
    ...overrides,
  };
}

export function orderRow(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    orderId: 10482,
    clientReference: '9f1c0a52-9d1e-4b62-8a51-0d6f6f3fa2e4',
    submittedAt: '2026-10-08T20:44:12+00:00',
    userId: '6f1c0a52-9d1e-4b62-8a51-0d6f6f3f6f10',
    userName: 'Sean Cheema',
    accountId: 7,
    accountName: 'Growth',
    symbol: 'AAPL',
    instrumentName: 'Apple Inc.',
    side: 'BUY',
    type: 'MARKET',
    quantity: 4,
    price: 316.59,
    indicativePrice: 316.5,
    status: 'FILLED',
    rejectionReason: null,
    ...overrides,
  };
}

// Three orders that differ in every column the tables sort and filter on.
export function orderRows(): OrderRow[] {
  return [
    orderRow(),
    orderRow({
      orderId: 10481,
      clientReference: '7b200a52-9d1e-4b62-8a51-0d6f6f3f11fd',
      submittedAt: '2026-10-08T20:43:58+00:00',
      userName: 'Priya Natarajan',
      accountName: 'Core',
      symbol: 'NVDA',
      instrumentName: 'NVIDIA Corporation',
      side: 'SELL',
      quantity: 25,
      price: 184.77,
    }),
    orderRow({
      orderId: 10480,
      clientReference: 'c3e90a52-9d1e-4b62-8a51-0d6f6f3f04b1',
      submittedAt: '2026-10-08T20:42:31+00:00',
      userName: 'Marcus Lee',
      accountName: 'Swing',
      symbol: 'TSLA',
      instrumentName: 'Tesla, Inc.',
      quantity: 40,
      price: null,
      status: 'REJECTED',
      rejectionReason: 'BR-09: insufficient funds for this order',
    }),
  ];
}

export function transferRow(overrides: Partial<TransferRow> = {}): TransferRow {
  return {
    transferId: 92590,
    at: '2026-10-08T20:43:00+00:00',
    userId: '6f1c0a52-9d1e-4b62-8a51-0d6f6f3f6f10',
    userName: 'Sean Cheema',
    accountId: 7,
    accountName: 'Growth',
    kind: 'DEPOSIT',
    amount: 2500,
    ...overrides,
  };
}

// A deposit that falls between the first two orders, and a withdrawal older than all three.
export function transferRows(): TransferRow[] {
  return [
    transferRow(),
    transferRow({
      transferId: 92570,
      at: '2026-10-08T20:12:00+00:00',
      userName: 'Priya Natarajan',
      accountName: 'Core',
      kind: 'WITHDRAWAL',
      amount: -800,
    }),
  ];
}

export function orderDetail(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    ...orderRow(),
    userEmail: 'sean@example.com',
    bufferPercent: 1,
    acceptedAt: '2026-10-08T20:44:12.050+00:00',
    resolvedAt: '2026-10-08T20:44:12.118+00:00',
    simulatedAt: '2026-10-09T13:34:07+00:00',
    fill: { fillId: 88482, price: 316.59, quantity: 4, filledAt: '2026-10-08T20:44:12.118+00:00' },
    ledger: {
      cashBefore: 6086.91,
      cashChange: -1266.36,
      cashAfter: 4820.55,
      holdingBefore: 0,
      holdingChange: 4,
      holdingAfter: 4,
      cashTransactionId: 92582,
      holdingMovementId: 95782,
    },
    audit: [
      { eventType: 'PENDING', detail: null, recordedAt: '2026-10-08T20:44:12.084+00:00' },
      { eventType: 'ACCEPTED', detail: null, recordedAt: '2026-10-08T20:44:12.091+00:00' },
      { eventType: 'FILLED', detail: 'Filled 4 @ 316.59', recordedAt: '2026-10-08T20:44:12.118+00:00' },
    ],
    ...overrides,
  };
}

export function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    userId: '6f1c0a52-9d1e-4b62-8a51-0d6f6f3f6f10',
    name: 'Sean Cheema',
    email: 'sean@example.com',
    role: 'TRADER',
    status: 'ACTIVE',
    traderLevel: 'ADVANCED',
    accounts: 2,
    cash: 4820.55,
    portfolio: 28985.08,
    failedAttempts: 0,
    lockedUntil: null,
    lastActiveAt: '2026-10-08T20:44:00+00:00',
    memberSince: '2026-01-02T15:00:00+00:00',
    ...overrides,
  };
}

// A trader, a locked-out beginner with nothing, and a trader who has signed up but
// has no trading profile yet.
export function customers(): Customer[] {
  return [
    customer(),
    customer({
      userId: '12bd0a52-9d1e-4b62-8a51-0d6f6f3f12bd',
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
      status: 'LOCKED',
      traderLevel: 'BEGINNER',
      accounts: 1,
      cash: 0,
      portfolio: 0,
      failedAttempts: 5,
      lockedUntil: '2026-10-08T21:15:00+00:00',
      lastActiveAt: '2026-10-07T20:30:00+00:00',
    }),
    customer({
      userId: '3b5f0a52-9d1e-4b62-8a51-0d6f6f3f3b5f',
      name: 'newcomer@example.com',
      email: 'newcomer@example.com',
      traderLevel: null,
      accounts: 0,
      cash: 0,
      portfolio: 0,
      lastActiveAt: null,
    }),
  ];
}

export function customerDetail(overrides: Partial<CustomerDetail> = {}): CustomerDetail {
  return {
    ...customer(),
    sessionTimeoutMinutes: 15,
    accountBalances: [
      { accountId: 7, name: 'Growth', value: 7604.68 },
      { accountId: 8, name: 'Retirement', value: 21380.4 },
    ],
    orders: [orderRow()],
    transfers: [transferRow()],
    total: 1,
    sessionId: 12,
    ...overrides,
  };
}
