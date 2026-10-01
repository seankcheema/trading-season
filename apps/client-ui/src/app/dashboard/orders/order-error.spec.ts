import { HttpErrorResponse } from '@angular/common/http';
import { ORDER_ERROR_MESSAGES, UnknownInstrumentError, toOrderErrorMessage } from './order-error';

function httpError(status: number, body: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body });
}

describe('toOrderErrorMessage', () => {
  it('should name the symbol problem when the instrument could not be resolved', () => {
    expect(toOrderErrorMessage(new UnknownInstrumentError('ZZZZ'))).toBe(
      ORDER_ERROR_MESSAGES.unknownInstrument,
    );
  });

  it('should treat a lost connection separately from a server fault', () => {
    expect(toOrderErrorMessage(httpError(0))).toBe(ORDER_ERROR_MESSAGES.network);
    expect(toOrderErrorMessage(httpError(500))).toBe(ORDER_ERROR_MESSAGES.unavailable);
    expect(toOrderErrorMessage(httpError(503))).toBe(ORDER_ERROR_MESSAGES.unavailable);
  });

  it('should ask the trader to sign in again on an expired session', () => {
    expect(toOrderErrorMessage(httpError(401))).toBe(ORDER_ERROR_MESSAGES.sessionExpired);
  });

  it('should give the same answer whether the account is not theirs or not there', () => {
    // 403 and 404 are deliberately indistinguishable to the trader: neither is an account
    // they can trade on, and saying which would confirm another user's account exists.
    expect(toOrderErrorMessage(httpError(403))).toBe(ORDER_ERROR_MESSAGES.notOwned);
    expect(toOrderErrorMessage(httpError(404))).toBe(ORDER_ERROR_MESSAGES.notOwned);
  });

  it('should surface the backend message on a bad request', () => {
    expect(toOrderErrorMessage(httpError(400, { error: 'No instrument 99' }))).toBe(
      'No instrument 99',
    );
  });

  it('should fall back to a generic message for a bad request with no usable detail', () => {
    expect(toOrderErrorMessage(httpError(400))).toBe(ORDER_ERROR_MESSAGES.invalid);
    expect(toOrderErrorMessage(httpError(400, { error: '' }))).toBe(ORDER_ERROR_MESSAGES.invalid);
    expect(toOrderErrorMessage(httpError(400, { error: 42 }))).toBe(ORDER_ERROR_MESSAGES.invalid);
  });

  it('should fall back for an unmapped status and for anything that is not an HTTP error', () => {
    expect(toOrderErrorMessage(httpError(418))).toBe(ORDER_ERROR_MESSAGES.failed);
    expect(toOrderErrorMessage(new Error('boom'))).toBe(ORDER_ERROR_MESSAGES.failed);
    expect(toOrderErrorMessage('boom')).toBe(ORDER_ERROR_MESSAGES.failed);
  });
});
