import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MailService, buildPasswordResetUrl } from './mail.service.js';

const sendMail = vi.fn().mockResolvedValue({ accepted: ['joanna@example.com'] });
const createTransport = vi.fn(() => ({ sendMail }));

vi.mock('nodemailer', () => ({
  createTransport: (options: unknown) => createTransport(options as never),
}));

describe('MailService', () => {
  let service: MailService;
  const environment = { ...process.env };

  beforeEach(async () => {
    sendMail.mockClear();
    createTransport.mockClear();
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_SECURE;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    delete process.env.MAIL_FROM;
    delete process.env.APP_BASE_URL;

    const module: TestingModule = await Test.createTestingModule({
      providers: [MailService],
    }).compile();

    service = module.get(MailService);
  });

  afterEach(() => {
    process.env = { ...environment };
  });

  describe('transport configuration', () => {
    it('should default to the Mailpit container in docker-compose', async () => {
      await service.sendPasswordReset('joanna@example.com', 'token', 30);

      expect(createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'localhost', port: 1025, secure: false }),
      );
    });

    it('should use the configured SMTP host and port', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';

      await service.sendPasswordReset('joanna@example.com', 'token', 30);

      expect(createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'smtp.example.com', port: 587 }),
      );
    });

    it('should omit credentials entirely when none are configured', async () => {
      // Passing an empty user makes nodemailer attempt AUTH, which Mailpit
      // rejects outright.
      await service.sendPasswordReset('joanna@example.com', 'token', 30);

      expect(createTransport.mock.calls[0][0]).toMatchObject({ auth: undefined });
    });

    it('should authenticate when credentials are configured', async () => {
      process.env.SMTP_USER = 'mailer';
      process.env.SMTP_PASSWORD = 'secret';

      await service.sendPasswordReset('joanna@example.com', 'token', 30);

      expect(createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ auth: { user: 'mailer', pass: 'secret' } }),
      );
    });

    it('should build the transport once and reuse it', async () => {
      await service.sendPasswordReset('joanna@example.com', 'token', 30);
      await service.sendPasswordReset('joanna@example.com', 'token', 30);

      expect(createTransport).toHaveBeenCalledTimes(1);
      expect(sendMail).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendPasswordReset', () => {
    it('should address the message to the account and carry the link', async () => {
      await service.sendPasswordReset('joanna@example.com', 'the-token', 30);

      const message = sendMail.mock.calls[0][0];
      expect(message.to).toBe('joanna@example.com');
      expect(message.subject).toMatch(/reset/i);
      expect(message.text).toContain('http://localhost:4200/reset-password?token=the-token');
      expect(message.html).toContain('http://localhost:4200/reset-password?token=the-token');
    });

    it('should say how long the link lasts and that it is single use', async () => {
      await service.sendPasswordReset('joanna@example.com', 'the-token', 30);

      const { text } = sendMail.mock.calls[0][0];
      expect(text).toContain('30 minutes');
      expect(text).toMatch(/once/);
    });

    it('should send from the configured address', async () => {
      process.env.MAIL_FROM = 'Trading Season <noreply@example.com>';

      await service.sendPasswordReset('joanna@example.com', 'the-token', 30);

      expect(sendMail.mock.calls[0][0].from).toBe('Trading Season <noreply@example.com>');
    });

    it('should propagate a rejection from the mail server', async () => {
      // AuthService.requestPasswordReset depends on this to revoke a token
      // that reached nobody.
      sendMail.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(
        service.sendPasswordReset('joanna@example.com', 'the-token', 30),
      ).rejects.toThrow('ECONNREFUSED');
    });
  });

  describe('buildPasswordResetUrl', () => {
    it('should point at the client application, not this service', () => {
      process.env.APP_BASE_URL = 'https://app.example.com';

      expect(buildPasswordResetUrl('abc')).toBe(
        'https://app.example.com/reset-password?token=abc',
      );
    });

    it('should not double the slash when the base URL has a trailing one', () => {
      process.env.APP_BASE_URL = 'https://app.example.com/';

      expect(buildPasswordResetUrl('abc')).toBe(
        'https://app.example.com/reset-password?token=abc',
      );
    });

    it('should escape a token so the query string survives', () => {
      // base64url never produces these, but a link that silently truncates
      // would be indistinguishable from an invalid token.
      expect(buildPasswordResetUrl('a+b/c=')).toContain('token=a%2Bb%2Fc%3D');
    });
  });
});
