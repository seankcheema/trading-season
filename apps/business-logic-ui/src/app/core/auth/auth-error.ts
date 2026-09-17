import { HttpErrorResponse } from '@angular/common/http';

// Which call failed, since the same status means different things for each.
export type AuthErrorContext = 'login' | 'register-auth' | 'register-profile';

// Raised by AuthService when an email is taken and the submitted password doesn't sign in to it.
export class EmailTakenError extends Error {
  constructor() {
    super('Email is already registered');
    this.name = 'EmailTakenError';
  }
}

// Raised by AuthService.register so callers know which of its two calls failed.
export class RegistrationStepError extends Error {
  constructor(
    readonly step: Exclude<AuthErrorContext, 'login'>,
    readonly original: unknown,
  ) {
    super(`Registration failed at ${step}`);
    this.name = 'RegistrationStepError';
  }
}

export const AUTH_ERROR_MESSAGES = {
  network: "Can't reach the server. Check your connection and try again.",
  unavailable: 'The service is unavailable right now. Please try again shortly.',
  invalidCredentials:
    'Incorrect email or password. Too many failed attempts will temporarily lock your account.',
  loginFailed: 'Something went wrong signing you in. Please try again.',
  emailTaken: 'An account with this email already exists. Sign in instead.',
  invalidRegistration: 'Please check your email and password.',
  profileEmailTaken: 'This email is already registered.',
  invalidProfile: "We couldn't save your profile details. Please review the form and try again.",
  registrationFailed: "We couldn't finish creating your account. Please try again.",
} as const;

// Maps a failed auth or registration call to a message that is safe and useful to show the user.
export function toAuthErrorMessage(error: unknown, context: AuthErrorContext): string {
  if (error instanceof EmailTakenError) {
    return AUTH_ERROR_MESSAGES.emailTaken;
  }
  if (error instanceof RegistrationStepError) {
    return toAuthErrorMessage(error.original, error.step);
  }
  if (!(error instanceof HttpErrorResponse)) {
    return context === 'login'
      ? AUTH_ERROR_MESSAGES.loginFailed
      : AUTH_ERROR_MESSAGES.registrationFailed;
  }
  if (error.status === 0) {
    return AUTH_ERROR_MESSAGES.network;
  }
  if (error.status >= 500) {
    return AUTH_ERROR_MESSAGES.unavailable;
  }

  switch (context) {
    case 'login':
      return error.status === 401
        ? AUTH_ERROR_MESSAGES.invalidCredentials
        : AUTH_ERROR_MESSAGES.loginFailed;
    case 'register-auth':
      if (error.status === 409) {
        return AUTH_ERROR_MESSAGES.emailTaken;
      }
      if (error.status === 400) {
        return nestValidationMessage(error) ?? AUTH_ERROR_MESSAGES.invalidRegistration;
      }
      return AUTH_ERROR_MESSAGES.registrationFailed;
    case 'register-profile':
      if (error.status === 409) {
        return AUTH_ERROR_MESSAGES.profileEmailTaken;
      }
      if (error.status === 400) {
        return AUTH_ERROR_MESSAGES.invalidProfile;
      }
      return AUTH_ERROR_MESSAGES.registrationFailed;
  }
}

// NestJS validation errors carry `message` as a string or a list of per-field strings.
function nestValidationMessage(error: HttpErrorResponse): string | null {
  const message = (error.error as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) {
    const parts = message.filter((part): part is string => typeof part === 'string');
    return parts.length ? parts.join('. ') : null;
  }
  return typeof message === 'string' && message ? message : null;
}
