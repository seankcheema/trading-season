import scenarioFile from './scenario.json';

/*
 * The scenario the suite runs against, read from the file the Reporting
 * Service is seeded from, so every figure a spec expects is worked out from the
 * same orders the service was given and not typed in a second time.
 */

export interface Person {
  userId: string;
  email: string;
  password: string;
  roles: string[];
  accessTokenSeconds?: number;
  profile?: { firstName: string; lastName: string; traderLevel: string; funds: number };
}

export interface Customer {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  traderLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  funds: number;
  failedLoginAttempts: number;
  lockedForHours?: number;
  accounts: { accountId: number; name: string; valuation: number }[];
}

export interface ScenarioOrder {
  orderId: number;
  accountId: number;
  symbol: string;
  name: string;
  instrumentId: number;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  status: 'FILLED' | 'REJECTED' | 'ACCEPTED';
  reason?: string;
  hoursAgo: number;
}

export interface ScenarioTransfer {
  transferId: number;
  accountId: number;
  reason: 'DEPOSIT' | 'WITHDRAWAL';
  amount: number;
  hoursAgo: number;
}

const scenario = scenarioFile as unknown as {
  staff: Person[];
  customers: Customer[];
  orders: ScenarioOrder[];
  transfers: ScenarioTransfer[];
};

export const staffAccounts = scenario.staff;
export const customers = scenario.customers;
export const orders = scenario.orders;
export const transfers = scenario.transfers;

function staff(email: string): Person {
  const person = scenario.staff.find((candidate) => candidate.email === email);
  if (!person) {
    throw new Error(`No staff account ${email} in the scenario`);
  }
  return person;
}

/** An admin: sees every screen. Has a trading profile, so the sidebar names them. */
export const admin = staff('admin@e2e.example.com');
/** An analyst: sees the report runs only. Has no profile, so the sidebar shows the email. */
export const analyst = staff('analyst@e2e.example.com');
/** The right credentials but neither role. */
export const trader = staff('trader@e2e.example.com');
/** An admin whose access tokens last three seconds, to reach the refresh path. */
export const shortLived = staff('short-lived@e2e.example.com');
/** Another such admin, whom a test demotes while signed in. */
export const demoted = staff('demoted@e2e.example.com');

export const fullName = (customer: Customer): string =>
  `${customer.firstName} ${customer.lastName}`;

export function customerOf(accountId: number): Customer {
  const owner = customers.find((customer) =>
    customer.accounts.some((account) => account.accountId === accountId),
  );
  if (!owner) {
    throw new Error(`No customer owns account ${accountId}`);
  }
  return owner;
}

export function accountName(accountId: number): string {
  return customerOf(accountId).accounts.find((account) => account.accountId === accountId)!.name;
}

export type Range = 'today' | '7d' | '30d' | '90d' | 'all';

/** The ranges' labels on the toggle, in order. */
export const RANGE_LABELS: Record<Range, string> = {
  today: 'Today',
  '7d': '7D',
  '30d': '30D',
  '90d': '90D',
  all: 'All',
};

// How far back each range reaches. The scenario keeps clear of the edges.
const RANGE_HOURS: Record<Range, number> = {
  // Every order is more than a day old, so none is in Today.
  today: 0,
  '7d': 7 * 24,
  '30d': 30 * 24,
  '90d': 90 * 24,
  all: Number.POSITIVE_INFINITY,
};

export const ordersIn = (range: Range): ScenarioOrder[] =>
  orders.filter((order) => order.hoursAgo <= RANGE_HOURS[range]);

export const transfersIn = (range: Range): ScenarioTransfer[] =>
  transfers.filter((transfer) => transfer.hoursAgo <= RANGE_HOURS[range]);

const notionalOf = (order: ScenarioOrder): number =>
  order.status === 'FILLED' ? order.quantity * order.price : 0;

const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);

export interface Figures {
  orders: number;
  filled: number;
  rejected: number;
  /** Filled over resolved, in percent, or null when nothing is resolved. */
  fillRate: number | null;
  notional: number;
  netCashFlow: number;
  activeTraders: number;
  /** What a report run reads: orders that ended, accounts among them, symbols filled. */
  resolved: number;
  accounts: number;
  symbols: number;
  sharesFilled: number;
}

export function figures(range: Range): Figures {
  const inRange = ordersIn(range);
  const filled = inRange.filter((order) => order.status === 'FILLED');
  const rejected = inRange.filter((order) => order.status === 'REJECTED');
  const resolved = [...filled, ...rejected];
  return {
    orders: inRange.length,
    filled: filled.length,
    rejected: rejected.length,
    fillRate: resolved.length ? (filled.length / resolved.length) * 100 : null,
    notional: sum(inRange.map(notionalOf)),
    netCashFlow: sum(transfersIn(range).map((transfer) => transfer.amount)),
    activeTraders: new Set(inRange.map((order) => customerOf(order.accountId).userId)).size,
    resolved: resolved.length,
    accounts: new Set(resolved.map((order) => order.accountId)).size,
    symbols: new Set(filled.map((order) => order.symbol)).size,
    sharesFilled: sum(filled.map((order) => order.quantity)),
  };
}

export interface SymbolFigures {
  symbol: string;
  orders: number;
  fills: number;
  shares: number;
  notional: number;
}

/** Per symbol, the most traded by notional first, as Most traded and a report run list them. */
export function bySymbol(range: Range): SymbolFigures[] {
  const rows = new Map<string, SymbolFigures>();
  for (const order of ordersIn(range)) {
    const row = rows.get(order.symbol) ?? {
      symbol: order.symbol,
      orders: 0,
      fills: 0,
      shares: 0,
      notional: 0,
    };
    row.orders += 1;
    if (order.status === 'FILLED') {
      row.fills += 1;
      row.shares += order.quantity;
    }
    row.notional += notionalOf(order);
    rows.set(order.symbol, row);
  }
  return [...rows.values()].sort((a, b) => b.notional - a.notional || b.orders - a.orders);
}

export interface SegmentFigures {
  level: Customer['traderLevel'];
  notional: number;
  orders: number;
  traders: number;
  accounts: number;
  filled: number;
  rejected: number;
}

/** Per trader level, lowest first. */
export function bySegment(range: Range): SegmentFigures[] {
  return (['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const).map((level) => {
    const own = ordersIn(range).filter(
      (order) => customerOf(order.accountId).traderLevel === level,
    );
    const resolved = own.filter((order) => order.status !== 'ACCEPTED');
    return {
      level,
      notional: sum(own.map(notionalOf)),
      orders: own.length,
      traders: new Set(own.map((order) => customerOf(order.accountId).userId)).size,
      accounts: new Set(resolved.map((order) => order.accountId)).size,
      filled: own.filter((order) => order.status === 'FILLED').length,
      rejected: own.filter((order) => order.status === 'REJECTED').length,
    };
  });
}

/** Money as the screens print it: $1,234 or, with places, $1,234.50; a minus sign before the dollar. */
export function usd(value: number, places = 0): string {
  const text = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  });
  return `${value < 0 ? '-' : ''}$${text}`;
}
