import { HttpErrorResponse } from '@angular/common/http';

// Which change failed, since the same status means different things for each.
export type AccountAction = 'create-account' | 'save-portfolio' | 'deposit' | 'withdraw';

// Raised by AccountStore before any request when an id is not among the caller's own.
export class NotOwnedError extends Error {
  constructor() {
    super('The account or portfolio does not belong to the signed-in user');
    this.name = 'NotOwnedError';
  }
}

export const ACCOUNT_ERROR_MESSAGES = {
  network: "Can't reach the server. Check your connection and try again.",
  unavailable: 'The service is unavailable right now. Please try again shortly.',
  sessionExpired: 'Your session has expired. Sign in again to continue.',
  notOwned: "That account or portfolio isn't available to you.",
  invalid: 'Please check the details and try again.',
  duplicateAccount: 'You already have an account with this name.',
  duplicatePortfolio: 'This account already has a portfolio with this name.',
  insufficientFunds: "This account doesn't have enough cash for that withdrawal.",
  failed: {
    'create-account': "We couldn't create the account. Please try again.",
    'save-portfolio': "We couldn't save the portfolio. Please try again.",
    deposit: "We couldn't complete the deposit. Please try again.",
    withdraw: "We couldn't complete the withdrawal. Please try again.",
  },
} as const;

// Maps a failed account, portfolio or cash transaction call to a message safe to show the user.
export function toAccountErrorMessage(error: unknown, action: AccountAction): string {
  if (error instanceof NotOwnedError) {
    return ACCOUNT_ERROR_MESSAGES.notOwned;
  }
  if (!(error instanceof HttpErrorResponse)) {
    return ACCOUNT_ERROR_MESSAGES.failed[action];
  }
  if (error.status === 0) {
    return ACCOUNT_ERROR_MESSAGES.network;
  }
  if (error.status >= 500) {
    return ACCOUNT_ERROR_MESSAGES.unavailable;
  }
  switch (error.status) {
    case 401:
      return ACCOUNT_ERROR_MESSAGES.sessionExpired;
    case 403:
    case 404:
      return ACCOUNT_ERROR_MESSAGES.notOwned;
    case 400:
      return backendMessage(error) ?? ACCOUNT_ERROR_MESSAGES.invalid;
    case 409:
    case 422:
      return conflictMessage(action);
    default:
      return ACCOUNT_ERROR_MESSAGES.failed[action];
  }
}

function conflictMessage(action: AccountAction): string {
  switch (action) {
    case 'create-account':
      return ACCOUNT_ERROR_MESSAGES.duplicateAccount;
    case 'save-portfolio':
      return ACCOUNT_ERROR_MESSAGES.duplicatePortfolio;
    case 'withdraw':
      return ACCOUNT_ERROR_MESSAGES.insufficientFunds;
    case 'deposit':
      return ACCOUNT_ERROR_MESSAGES.failed.deposit;
  }
}

// The Java backend's error envelope carries a single `error` string.
function backendMessage(error: HttpErrorResponse): string | null {
  const message = (error.error as { error?: unknown } | null)?.error;
  return typeof message === 'string' && message ? message : null;
}
