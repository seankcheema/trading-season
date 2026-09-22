// Shapes of the Java backend's account, holding and cash endpoints. Every endpoint is scoped
// to the bearer token's subject; see docs/reference/api.md.
//
// Cash belongs to the user and is shared by all of their accounts. An account holds positions
// only, and its portfolio is simply those holdings. Net worth is the user's cash plus the value
// of every account's portfolio.

export interface Account {
  accountId: number;
  name: string;
  // ISO date, YYYY-MM-DD.
  openedDate: string;
}

export interface AccountHolding {
  symbol: string;
  quantity: number;
  // Average price paid per share.
  averageCost: number;
}

export type CashTransactionReason = 'DEPOSIT' | 'WITHDRAWAL';

export interface CashTransaction {
  cashTransactionId: number;
  // Always positive; the reason gives the direction.
  amount: number;
  reason: CashTransactionReason;
  // ISO-8601 instant.
  createdAt: string;
}

// The part of GET /api/users/me the dashboard reads: the user's shared cash.
export interface UserFunds {
  availableFunds: number;
}

// Creating and renaming an account take the same details. A new account starts empty.
export interface AccountDetails {
  name: string;
}

// Largest single deposit or withdrawal the dashboard accepts.
export const MAX_CASH_AMOUNT = 1_000_000;
