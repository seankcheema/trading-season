/**
 * Marks a completed password reset on the login page, which greets the user with a
 * confirmation instead of a bare form.
 *
 * It lives here rather than on ResetPasswordComponent so the login page can read it without
 * importing that lazily loaded component, which would pull it into the initial bundle.
 * Companion to INACTIVE_SIGN_OUT_REASON: both are values of the same `reason` parameter.
 */
export const PASSWORD_RESET_SUCCESS_REASON = 'password-reset';
