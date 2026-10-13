import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainError } from '@dar/shared';
import type { Request, Response } from 'express';

/**
 * Converts every error into a safe JSON body: { error: { code, message, details? } }.
 * Internal messages, stack traces, SQL and personal data never reach clients.
 */

// Messages raised by database triggers (see migrations) mapped to API codes.
const DB_GUARD_CODES: [RegExp, string, number][] = [
  [/APPEND_ONLY/, 'FINANCIAL_HISTORY_IMMUTABLE', 409],
  [/PAYMENT_EXCEEDS_BALANCE/, 'PAYMENT_EXCEEDS_BALANCE', 422],
  [/PAYOUT_EXCEEDS_COLLECTED/, 'PAYOUT_EXCEEDS_COLLECTED', 422],
  [/ALREADY_REVERSED/, 'ALREADY_REVERSED', 409],
  [/REVERSAL_MISMATCH/, 'REVERSAL_MISMATCH', 422],
  [/LEDGER_NEGATIVE_BALANCE/, 'REFUND_EXCEEDS_COLLECTED', 422],
  [/AGREEMENT_TERMS_FROZEN/, 'AGREEMENT_TERMS_FROZEN', 409],
  [/CLOSING_TERMS_FROZEN/, 'CLOSING_TERMS_FROZEN', 409],
  [/OBLIGATION_CLOSED|OBLIGATION_WAIVED/, 'OBLIGATION_CLOSED', 409],
  [/no_double_booking/, 'EMPLOYEE_DOUBLE_BOOKED', 409],
  [/activeKey/, 'PROPERTY_ALREADY_LEASED', 409],
  [/approvedKey/, 'PROPERTY_ALREADY_SOLD', 409],
  [/openKey/, 'LEAD_ALREADY_OPEN', 409],
  [/pendingKey/, 'REVISION_ALREADY_PENDING', 409],
  [/idempotencyKey/, 'DUPLICATE_REQUEST', 409],
];

const DOMAIN_STATUS: Record<string, number> = {
  INVALID_TRANSITION: 409,
  TRANSITION_REASON_REQUIRED: 422,
  LISTING_NOT_PUBLIC: 404,
  EMPLOYEE_DOUBLE_BOOKED: 409,
  NOTHING_PAYABLE: 422,
};

@Catch()
export class ErrorsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const req = host.switchToHttp().getRequest<Request & { requestId?: string }>();
    const { status, body } = this.toResponse(exception);
    if (status >= 500) {
      // Log the error type and request id only; no bodies, tokens or personal data.
      this.logger.error(`${req.method} ${req.path} → ${status} [${req.requestId ?? '-'}] ${(exception as Error)?.name}: ${safeMessage(exception)}`);
    }
    res.status(status).json(body);
  }

  private toResponse(e: unknown): { status: number; body: { error: { code: string; message: string; details?: unknown } } } {
    if (e instanceof DomainError) {
      return { status: DOMAIN_STATUS[e.code] ?? 422, body: { error: { code: e.code, message: e.message, details: e.details } } };
    }
    if (e instanceof HttpException) {
      const status = e.getStatus();
      const r = e.getResponse() as any;
      const code =
        typeof r === 'object' && r?.code
          ? r.code
          : status === 401
            ? 'UNAUTHENTICATED'
            : status === 403
              ? 'FORBIDDEN'
              : status === 404
                ? 'NOT_FOUND'
                : status === 429
                  ? 'RATE_LIMITED'
                  : 'REQUEST_FAILED';
      const message = typeof r === 'object' && typeof r?.message === 'string' ? r.message : e.message;
      return { status, body: { error: { code, message, details: typeof r === 'object' ? r?.details : undefined } } };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      const text = `${e.message} ${JSON.stringify(e.meta ?? {})}`;
      for (const [re, code, status] of DB_GUARD_CODES) if (re.test(text)) return { status, body: { error: { code, message: code } } };
      if (e.code === 'P2002') return { status: 409, body: { error: { code: 'CONFLICT', message: 'Already exists' } } };
      if (e.code === 'P2025') return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found' } } };
      if (e.code === 'P2034') return { status: 409, body: { error: { code: 'CONCURRENT_UPDATE', message: 'Please retry' } } };
    }
    if (e instanceof Prisma.PrismaClientUnknownRequestError || e instanceof Error) {
      const text = (e as Error).message;
      for (const [re, code, status] of DB_GUARD_CODES) if (re.test(text)) return { status, body: { error: { code, message: code } } };
    }
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, body: { error: { code: 'INTERNAL', message: 'Something went wrong' } } };
  }
}

function safeMessage(e: unknown): string {
  const m = (e as Error)?.message ?? String(e);
  // Strip anything that looks like an email, phone number or token before logging.
  return m
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/\+?\d[\d\s-]{6,}\d/g, '[number]')
    .replace(/[A-Za-z0-9_-]{32,}/g, '[token]')
    .slice(0, 300);
}
