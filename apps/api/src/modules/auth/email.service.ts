import { Injectable, Logger } from '@nestjs/common';
import { env } from '../../config/env';

/**
 * Email adapter. `console` prints messages in development only (blocked in
 * production by config validation). `smtp` is a documented integration point:
 * wire your provider (e.g. nodemailer + SMTP_URL, or an HTTP email API) in
 * sendViaProvider. `none` disables email; password reset then cannot complete
 * and the API says so honestly rather than pretending an email was sent.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger('Email');

  get configured(): boolean {
    return env().EMAIL_DRIVER === 'console' || (env().EMAIL_DRIVER === 'smtp' && !!env().SMTP_URL);
  }

  async send(to: string, subject: string, text: string): Promise<'SENT' | 'LOGGED_DEV' | 'UNCONFIGURED'> {
    const driver = env().EMAIL_DRIVER;
    if (driver === 'console' && env().NODE_ENV !== 'production') {
      this.logger.log(`[DEV EMAIL] to=${to.replace(/^(.).*@/, '$1***@')} subject="${subject}"\n${text}`);
      return 'LOGGED_DEV';
    }
    if (driver === 'smtp' && env().SMTP_URL) {
      await this.sendViaProvider(to, subject, text);
      return 'SENT';
    }
    return 'UNCONFIGURED';
  }

  // Integration point — intentionally not implemented without credentials.
  private async sendViaProvider(_to: string, _subject: string, _text: string): Promise<void> {
    throw new Error('EMAIL_PROVIDER_NOT_IMPLEMENTED: add your SMTP/HTTP email client here (see docs/INTEGRATIONS.md)');
  }
}
