import { HttpErrorResponse } from '@angular/common/http';

// Raised before any request when the dashboard cannot name the instrument behind a symbol,
// so there is no instrumentId to submit.
export class UnknownInstrumentError extends Error {
  constructor(readonly symbol: string) {
    super(`No instrument matches the symbol ${symbol}`);
    this.name = 'UnknownInstrumentError';
  }
}

export class TradeEligibilityError extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

export const ORDER_ERROR_MESSAGES = {
  network: "Can't reach the server. Check your connection and try again.",
  unavailable: 'The service is unavailable right now. Please try again shortly.',
  sessionExpired: 'Your session has expired. Sign in again to continue.',
  notOwned: "That account isn't available to you.",
  unknownInstrument: "We couldn't find that symbol. Pick another and try again.",
  invalid: 'Please check the order details and try again.',
  failed: "We couldn't submit the order. Please try again.",
} as const;

// Maps a failed order submission to a message safe to show the trader.
//
// A rejected trade is not an error and never reaches here: the backend answers it 201 with a
// REJECTED status and a reason, which the dialog shows as the order's outcome.
export function toOrderErrorMessage(error: unknown): string {
  if (error instanceof TradeEligibilityError) return error.reason;
  if (error instanceof UnknownInstrumentError) {
    return ORDER_ERROR_MESSAGES.unknownInstrument;
  }
  if (!(error instanceof HttpErrorResponse)) {
    return ORDER_ERROR_MESSAGES.failed;
  }
  if (error.status === 0) {
    return ORDER_ERROR_MESSAGES.network;
  }
  if (error.status >= 500) {
    return ORDER_ERROR_MESSAGES.unavailable;
  }
  switch (error.status) {
    case 401:
      return ORDER_ERROR_MESSAGES.sessionExpired;
    case 403:
    case 404:
      return ORDER_ERROR_MESSAGES.notOwned;
    case 400:
      return backendMessage(error) ?? ORDER_ERROR_MESSAGES.invalid;
    default:
      return ORDER_ERROR_MESSAGES.failed;
  }
}

// The Java backend's error envelope carries a single `error` string.
function backendMessage(error: HttpErrorResponse): string | null {
  const message = (error.error as { error?: unknown } | null)?.error;
  return typeof message === 'string' && message ? message : null;
}
