// Who may use this app. The Reporting Service enforces the same rule on its run
// endpoints (403 without the role); the checks here only decide what to show.

// The role, as the auth service writes it in the access token's `roles` claim.
export const REPORTING_ROLE = 'ANALYST';

// `reason` query parameter on /login when a signed-in account was turned away.
export const NO_ACCESS_REASON = 'role';

export const NO_ACCESS_MESSAGE =
  "This account doesn't have access to reporting. Sign in with an analyst account.";

// Raised by AuthService.login when the credentials are right but the account is not an analyst.
export class ReportingAccessError extends Error {
  constructor() {
    super('Account does not have the reporting role');
    this.name = 'ReportingAccessError';
  }
}
