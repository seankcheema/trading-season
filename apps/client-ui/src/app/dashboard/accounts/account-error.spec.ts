import { HttpErrorResponse } from '@angular/common/http';
import { ACCOUNT_ERROR_MESSAGES, NotOwnedError, toAccountErrorMessage } from './account-error';

function httpError(status: number, error: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({ status, error });
}

describe('toAccountErrorMessage', () => {
  it('explains an account the user does not own', () => {
    expect(toAccountErrorMessage(new NotOwnedError(), 'deposit')).toBe(
      ACCOUNT_ERROR_MESSAGES.notOwned,
    );
    expect(toAccountErrorMessage(httpError(403), 'rename-account')).toBe(
      ACCOUNT_ERROR_MESSAGES.notOwned,
    );
    expect(toAccountErrorMessage(httpError(404), 'withdraw')).toBe(ACCOUNT_ERROR_MESSAGES.notOwned);
  });

  it('falls back to a per-action message for errors that are not HTTP responses', () => {
    expect(toAccountErrorMessage(new Error('boom'), 'create-account')).toBe(
      ACCOUNT_ERROR_MESSAGES.failed['create-account'],
    );
  });

  it('distinguishes network, server and session failures', () => {
    expect(toAccountErrorMessage(httpError(0), 'deposit')).toBe(ACCOUNT_ERROR_MESSAGES.network);
    expect(toAccountErrorMessage(httpError(503), 'deposit')).toBe(
      ACCOUNT_ERROR_MESSAGES.unavailable,
    );
    expect(toAccountErrorMessage(httpError(401), 'deposit')).toBe(
      ACCOUNT_ERROR_MESSAGES.sessionExpired,
    );
  });

  it("shows the backend's validation message when it sends one", () => {
    expect(
      toAccountErrorMessage(httpError(400, { error: 'amount must be positive' }), 'deposit'),
    ).toBe('amount must be positive');
    expect(toAccountErrorMessage(httpError(400, { error: '' }), 'deposit')).toBe(
      ACCOUNT_ERROR_MESSAGES.invalid,
    );
    expect(toAccountErrorMessage(httpError(400), 'deposit')).toBe(ACCOUNT_ERROR_MESSAGES.invalid);
  });

  it('explains a conflict in terms of the action', () => {
    expect(toAccountErrorMessage(httpError(409), 'create-account')).toBe(
      ACCOUNT_ERROR_MESSAGES.duplicateAccount,
    );
    expect(toAccountErrorMessage(httpError(409), 'rename-account')).toBe(
      ACCOUNT_ERROR_MESSAGES.duplicateAccount,
    );
    expect(toAccountErrorMessage(httpError(422), 'withdraw')).toBe(
      ACCOUNT_ERROR_MESSAGES.insufficientFunds,
    );
    expect(toAccountErrorMessage(httpError(409), 'deposit')).toBe(
      ACCOUNT_ERROR_MESSAGES.failed.deposit,
    );
  });

  it('uses the per-action message for any other status', () => {
    expect(toAccountErrorMessage(httpError(418), 'withdraw')).toBe(
      ACCOUNT_ERROR_MESSAGES.failed.withdraw,
    );
  });
});
