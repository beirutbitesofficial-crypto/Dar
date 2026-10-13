import { Injectable, NotFoundException } from '@nestjs/common';
import {
  DEFAULT_RENTAL_FEE_RULES,
  DEFAULT_SALE_FEE_RULES,
  PricingSettings,
  PublicSettings,
  RentalPricingMode,
  validatePricingSettings,
} from '@dar/shared';
import { AuditService } from '../../common/audit.service';
import { big, toCents } from '../../common/money';
import { PrismaService, Tx } from '../../common/prisma.service';

export interface ReminderSettings {
  daysBeforeDue: number[];
  daysAfterDue: number[];
}
export const DEFAULT_REMINDERS: ReminderSettings = { daysBeforeDue: [3, 0], daysAfterDue: [3, 10] };

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Latest pricing settings version. Every transaction snapshots this. */
  async current(tx?: Tx): Promise<PricingSettings> {
    const row = await (tx ?? this.prisma).pricingSettings.findFirst({ orderBy: { version: 'desc' } });
    if (!row) {
      // Fresh database before seeding: fall back to the documented defaults.
      return { version: 0, termsVersion: 'unset', sale: DEFAULT_SALE_FEE_RULES, rental: DEFAULT_RENTAL_FEE_RULES };
    }
    return {
      version: row.version,
      termsVersion: row.termsVersion,
      sale: { buyerBps: row.saleBuyerBps, sellerBps: row.saleSellerBps },
      rental: { mode: row.rentalPricingMode as RentalPricingMode, monthlyFeeCents: toCents(row.rentalMonthlyFeeCents) },
    };
  }

  async publicSettings(): Promise<PublicSettings> {
    const s = await this.current();
    const terms = await this.prisma.legalDocument.findFirst({ where: { kind: 'TERMS' }, orderBy: { publishedAt: 'desc' } });
    return {
      saleBuyerBps: s.sale.buyerBps,
      saleSellerBps: s.sale.sellerBps,
      rentalMonthlyFeeCents: s.rental.monthlyFeeCents,
      rentalPricingMode: s.rental.mode,
      termsVersion: s.termsVersion,
      legalReviewPending: terms?.legalReviewPending ?? true,
    };
  }

  /** Creates a NEW version. Existing requests and agreements keep their snapshots. */
  async update(
    actorId: string,
    input: { saleBuyerBps: number; saleSellerBps: number; rentalMonthlyFeeCents: number; rentalPricingMode: RentalPricingMode; termsVersion: string; changeReason: string },
  ) {
    validatePricingSettings({
      sale: { buyerBps: input.saleBuyerBps, sellerBps: input.saleSellerBps },
      rental: { mode: input.rentalPricingMode, monthlyFeeCents: input.rentalMonthlyFeeCents },
      termsVersion: input.termsVersion,
    });
    return this.prisma.serializable(async (tx) => {
      const prev = await this.current(tx);
      const row = await tx.pricingSettings.create({
        data: {
          version: prev.version + 1,
          saleBuyerBps: input.saleBuyerBps,
          saleSellerBps: input.saleSellerBps,
          rentalMonthlyFeeCents: big(input.rentalMonthlyFeeCents),
          rentalPricingMode: input.rentalPricingMode,
          termsVersion: input.termsVersion,
          changeReason: input.changeReason,
          createdById: actorId,
        },
      });
      await this.audit.log(
        {
          actorId,
          action: 'pricing.settings_changed',
          entityType: 'PricingSettings',
          entityId: row.id,
          metadata: { fromVersion: prev.version, toVersion: row.version, reason: input.changeReason },
        },
        tx,
      );
      return row.version;
    });
  }

  async history() {
    const rows = await this.prisma.pricingSettings.findMany({ orderBy: { version: 'desc' }, take: 100 });
    return rows.map((r) => ({ ...r, rentalMonthlyFeeCents: toCents(r.rentalMonthlyFeeCents) }));
  }

  async legal(kind: 'TERMS' | 'PRIVACY') {
    const doc = await this.prisma.legalDocument.findFirst({ where: { kind }, orderBy: { publishedAt: 'desc' } });
    if (!doc) throw new NotFoundException();
    return doc;
  }

  async publishLegal(actorId: string, input: { kind: 'TERMS' | 'PRIVACY'; version: string; bodyAr: string; bodyEn: string; legalReviewPending: boolean }) {
    const doc = await this.prisma.legalDocument.create({ data: input });
    await this.audit.log({ actorId, action: 'legal.published', entityType: 'LegalDocument', entityId: doc.id, metadata: { kind: input.kind, version: input.version } });
    return doc;
  }

  async reminders(): Promise<ReminderSettings> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: 'reminders' } });
    return (row?.value as unknown as ReminderSettings) ?? DEFAULT_REMINDERS;
  }

  async setReminders(actorId: string, value: ReminderSettings) {
    await this.prisma.appSetting.upsert({
      where: { key: 'reminders' },
      create: { key: 'reminders', value: value as any, updatedById: actorId },
      update: { value: value as any, updatedById: actorId },
    });
  }
}
