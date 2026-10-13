import { Global, Injectable, Module } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { env } from '../config/env';
import { PrismaService, Tx } from './prisma.service';

/**
 * Append-only audit trail for financial changes, permission changes and access
 * to sensitive data (owner contacts, exact locations, private documents).
 * Metadata must not contain secrets or personal contact data — store ids and
 * field names, not values.
 */
export type AuditAction =
  | 'auth.login'
  | 'auth.login_failed'
  | 'auth.password_reset'
  | 'auth.session_reuse_detected'
  | 'user.roles_changed'
  | 'user.blocked'
  | 'user.unblocked'
  | 'user.deletion_requested'
  | 'user.anonymized'
  | 'sensitive.owner_contact_viewed'
  | 'sensitive.exact_location_viewed'
  | 'sensitive.document_viewed'
  | 'sensitive.customer_contact_viewed'
  | 'listing.submitted'
  | 'listing.approved'
  | 'listing.rejected'
  | 'listing.status_changed'
  | 'listing.revision_approved'
  | 'listing.revision_rejected'
  | 'listing.assigned'
  | 'listing.featured'
  | 'media.reviewed'
  | 'lead.assigned'
  | 'lead.status_changed'
  | 'viewing.confirmed'
  | 'viewing.outcome'
  | 'pricing.settings_changed'
  | 'legal.published'
  | 'sale.closing_requested'
  | 'sale.closing_approved'
  | 'sale.closing_cancelled'
  | 'sale.payment_recorded'
  | 'sale.refund_recorded'
  | 'sale.reversal_recorded'
  | 'sale.obligation_waived'
  | 'rental.agreement_created'
  | 'rental.acceptance_recorded'
  | 'rental.agreement_activated'
  | 'rental.agreement_amended'
  | 'rental.agreement_terminated'
  | 'rental.agreement_ended'
  | 'rental.agreement_cancelled'
  | 'rental.obligations_generated'
  | 'rental.obligation_adjusted'
  | 'rental.obligation_voided'
  | 'rental.obligation_waived'
  | 'rental.payment_recorded'
  | 'rental.reversal_recorded'
  | 'rental.refund_recorded'
  | 'rental.deposit_recorded'
  | 'payout.recorded'
  | 'payout.reversed'
  | 'message.hidden'
  | 'report.resolved'
  | 'location.changed'
  | 'template.changed'
  | 'export.csv';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    entry: { actorId: string | null; action: AuditAction; entityType: string; entityId: string; metadata?: Record<string, unknown>; ip?: string },
    tx?: Tx,
  ) {
    const client = tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: (entry.metadata ?? undefined) as any,
        // Hashed so the audit trail can correlate requests without storing raw IPs.
        ipHash: entry.ip ? createHash('sha256').update(`${env().TOKEN_HASH_PEPPER}:${entry.ip}`).digest('hex').slice(0, 24) : null,
      },
    });
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
