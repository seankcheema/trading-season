// Who may use this app, and how much of it. The Reporting Service enforces the same
// rules on its endpoints (403 without the role); the checks here only decide what to show.

// The role that sees every screen, as the auth service writes it in the access
// token's `roles` claim.
export const ADMIN_ROLE = 'ADMIN';

// The roles that may sign in at all. An analyst sees the report runs and nothing else.
export const REPORTING_ROLES: readonly string[] = ['ANALYST', ADMIN_ROLE];

// Where an account lands when a screen is not its to see: the one every role has.
export const HOME_FOR_EVERY_ROLE = '/runs';

// `reason` query parameter on /login when a signed-in account was turned away.
export const NO_ACCESS_REASON = 'role';

export const NO_ACCESS_MESSAGE =
  "This account doesn't have access to reporting. Sign in with an analyst or admin account.";

// Raised by AuthService.login when the credentials are right but the account has no reporting role.
export class ReportingAccessError extends Error {
  constructor() {
    super('Account does not have a reporting role');
    this.name = 'ReportingAccessError';
  }
}
