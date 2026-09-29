import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

/** Default SMTP target: the Mailpit container in infrastructure/docker-compose. */
const DEFAULT_SMTP_HOST = 'localhost';
const DEFAULT_SMTP_PORT = 1025;

/** Where the reset link points, which is the Angular client, not this service. */
const DEFAULT_APP_BASE_URL = 'http://localhost:4200';

const DEFAULT_MAIL_FROM = 'Trading Season <no-reply@dualeapa.local>';

/** The client route that takes the token out of the link and asks for a new password. */
const RESET_PASSWORD_PATH = '/reset-password';

/**
 * Outbound email.
 *
 * Development and CI point this at Mailpit, which speaks SMTP on 1025 and shows
 * what was sent on http://localhost:8025 — so the reset flow can be exercised
 * end to end without delivering anything to a real mailbox. Production supplies
 * a real host through the same SMTP_* variables; nothing here is Mailpit
 * specific beyond the defaults.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  /**
   * Built on first use rather than in the constructor.
   *
   * Nothing about a NestJS boot should depend on an SMTP server being up, and
   * this service is injected into AuthService, which every login goes through.
   */
  private transporter: Transporter | null = null;

  /**
   * Email a password reset link.
   *
   * Throws when the SMTP server does not accept the message, which the caller
   * uses to invalidate a token nobody ever received. It deliberately does not
   * throw for an address that turns out not to exist at the destination: SMTP
   * reports that asynchronously, if at all.
   */
  async sendPasswordReset(
    email: string,
    token: string,
    expiresInMinutes: number,
  ): Promise<void> {
    const url = buildPasswordResetUrl(token);

    await this.transport().sendMail({
      from: process.env.MAIL_FROM || DEFAULT_MAIL_FROM,
      to: email,
      subject: 'Reset your Trading Season password',
      text: [
        'We received a request to reset the password for your Trading Season account.',
        '',
        `Open this link to choose a new password: ${url}`,
        '',
        `The link stops working in ${expiresInMinutes} minutes, and can be used once.`,
        'If you did not ask for a reset, you can ignore this email — your password is unchanged.',
      ].join('\n'),
      html: [
        '<p>We received a request to reset the password for your Trading Season account.</p>',
        `<p><a href="${url}">Choose a new password</a></p>`,
        `<p>The link stops working in ${expiresInMinutes} minutes, and can be used once.</p>`,
        '<p>If you did not ask for a reset, you can ignore this email — your password is unchanged.</p>',
      ].join(''),
    });

    // The address is logged, the token is not: the log would otherwise be a
    // second place the reset link exists, readable by anyone with log access.
    this.logger.debug(`Password reset email sent to ${email}`);
  }

  private transport(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const host = process.env.SMTP_HOST || DEFAULT_SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || String(DEFAULT_SMTP_PORT));
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;

    this.logger.log(`Sending mail through SMTP at ${host}:${port}`);

    this.transporter = createTransport({
      host,
      port,
      // Mailpit and most submission-port relays start plaintext and upgrade;
      // SMTP_SECURE=true is for the implicit-TLS port (usually 465).
      secure: process.env.SMTP_SECURE === 'true',
      // Omitted entirely when unset. Passing an empty user makes nodemailer
      // attempt AUTH, which Mailpit rejects.
      auth: user ? { user, pass } : undefined,
    });

    return this.transporter;
  }
}

/**
 * The link the email carries.
 *
 * Built from APP_BASE_URL because it has to open the Angular client, which is
 * on a different origin from this service. A trailing slash on the configured
 * value would otherwise produce a double slash in the path.
 */
export function buildPasswordResetUrl(token: string): string {
  const baseUrl = (process.env.APP_BASE_URL || DEFAULT_APP_BASE_URL).replace(/\/+$/, '');
  return `${baseUrl}${RESET_PASSWORD_PATH}?token=${encodeURIComponent(token)}`;
}
