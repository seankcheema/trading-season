/**
 * The roles an account can hold, as stored in `user_accounts.user_role` and
 * carried in the access token's `roles` claim. The database check constraint
 * (db/migrations) lists the same values; add a role in both places.
 *
 * - TRADER: the default for every registration.
 * - ANALYST: may read the reporting service's report runs, and is the only
 *   role the Reporting UI admits. Never assigned by registration.
 * - ADMIN: reserved; no service grants it anything today.
 */
export const USER_ROLES = ['ADMIN', 'TRADER', 'ANALYST'] as const;

export type UserRole = (typeof USER_ROLES)[number];
