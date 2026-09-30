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
});
