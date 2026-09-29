import { HttpErrorResponse } from '@angular/common/http';
import {
  AUTH_ERROR_MESSAGES,
  EmailTakenError,
  RegistrationStepError,
  toAuthErrorMessage,
} from './auth-error';

const httpError = (status: number, error: unknown = null) =>
  new HttpErrorResponse({ status, error });

describe('toAuthErrorMessage', () => {
  it('reports an unreachable server', () => {
    expect(toAuthErrorMessage(httpError(0), 'login')).toBe(AUTH_ERROR_MESSAGES.network);
  });

  it('reports server errors as unavailable', () => {
    expect(toAuthErrorMessage(httpError(503), 'register-auth')).toBe(AUTH_ERROR_MESSAGES.unavailable);
  });

  it('maps a rejected login to a generic credentials message', () => {
    expect(toAuthErrorMessage(httpError(401), 'login')).toBe(AUTH_ERROR_MESSAGES.invalidCredentials);
    expect(toAuthErrorMessage(httpError(400), 'login')).toBe(AUTH_ERROR_MESSAGES.loginFailed);
  });

  it('shows the auth service validation messages for registration', () => {
    const error = httpError(400, { message: ['A valid email address is required', 'Password is too short'] });
    expect(toAuthErrorMessage(error, 'register-auth')).toBe(
      'A valid email address is required. Password is too short',
    );
    expect(toAuthErrorMessage(httpError(400), 'register-auth')).toBe(
      AUTH_ERROR_MESSAGES.invalidRegistration,
    );
  });

  it('maps profile failures to profile messages', () => {
    expect(toAuthErrorMessage(httpError(409), 'register-profile')).toBe(
      AUTH_ERROR_MESSAGES.profileEmailTaken,
    );
    expect(toAuthErrorMessage(httpError(400), 'register-profile')).toBe(AUTH_ERROR_MESSAGES.invalidProfile);
  });

  it('uses the step carried by a registration error', () => {
    const error = new RegistrationStepError('register-profile', httpError(400));
    expect(toAuthErrorMessage(error, 'register-auth')).toBe(AUTH_ERROR_MESSAGES.invalidProfile);
  });

  it('reports a taken email', () => {
    expect(toAuthErrorMessage(new EmailTakenError(), 'register-auth')).toBe(AUTH_ERROR_MESSAGES.emailTaken);
  });

  it('falls back to a generic message for unexpected errors', () => {
    expect(toAuthErrorMessage(new Error('boom'), 'login')).toBe(AUTH_ERROR_MESSAGES.loginFailed);
    expect(toAuthErrorMessage(new Error('boom'), 'register-auth')).toBe(
      AUTH_ERROR_MESSAGES.registrationFailed,
    );
  });

  it('maps a failed reset request to a message that reveals nothing about the address', () => {
    // Nothing here may differ by whether the address has an account; the service answers
    // 202 either way, so only transport and validation failures reach this function.
    expect(toAuthErrorMessage(httpError(500), 'forgot-password')).toBe(
      AUTH_ERROR_MESSAGES.unavailable,
    );
    expect(toAuthErrorMessage(httpError(400), 'forgot-password')).toBe(
      AUTH_ERROR_MESSAGES.invalidRegistration,
    );
    expect(toAuthErrorMessage(httpError(429), 'forgot-password')).toBe(
      AUTH_ERROR_MESSAGES.resetRequestFailed,
    );
  });

  it('passes through the service wording for a rejected reset link', () => {
    expect(
      toAuthErrorMessage(
        httpError(400, { message: 'This password reset link is invalid or has expired' }),
        'reset-password',
      ),
    ).toBe('This password reset link is invalid or has expired');
  });

  it('reports a rejected password from the reset form', () => {
    expect(
      toAuthErrorMessage(
        httpError(400, { message: ['Password must be at least 8 characters long'] }),
        'reset-password',
      ),
    ).toBe('Password must be at least 8 characters long');
  });

  it('falls back to a reset-specific message without a usable body', () => {
    expect(toAuthErrorMessage(httpError(400), 'reset-password')).toBe(
      AUTH_ERROR_MESSAGES.resetLinkInvalid,
    );
    expect(toAuthErrorMessage(httpError(404), 'reset-password')).toBe(
      AUTH_ERROR_MESSAGES.resetFailed,
    );
    expect(toAuthErrorMessage(new Error('boom'), 'reset-password')).toBe(
      AUTH_ERROR_MESSAGES.resetFailed,
    );
    expect(toAuthErrorMessage(new Error('boom'), 'forgot-password')).toBe(
      AUTH_ERROR_MESSAGES.resetRequestFailed,
    );
  });
});
