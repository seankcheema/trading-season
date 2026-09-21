// Shapes of the Java backend's account, portfolio and cash transaction endpoints.
// Every endpoint is scoped to the bearer token's subject; see docs/reference/api.md.

export type Currency = 'USD';

export const ACCOUNT_CURRENCIES: readonly Currency[] = ['USD'];

export interface Account {
  accountId: number;
  name: string;
  currency: Currency;
  cashBalance: number;
  // ISO date, YYYY-MM-DD.
  openedDate: string;
}

export interface Portfolio {
  portfolioId: number;
  accountId: number;
  name: string;
  description: string | null;
  // ISO-8601 instant.
  createdAt: string;
}

export type CashTransactionReason = 'DEPOSIT' | 'WITHDRAWAL';

export interface CashTransaction {
  cashTransactionId: number;
  accountId: number;
  // Always positive; the reason gives the direction.
  amount: number;
  reason: CashTransactionReason;
  // ISO-8601 instant.
  createdAt: string;
}

export interface NewAccount {
  name: string;
  currency: Currency;
  initialDeposit?: number;
}

export interface PortfolioDetails {
  name: string;
  description: string | null;
}

export interface NewPortfolio extends PortfolioDetails {
  accountId: number;
}

// Largest single deposit, withdrawal or opening deposit the dashboard accepts.
export const MAX_CASH_AMOUNT = 1_000_000;
