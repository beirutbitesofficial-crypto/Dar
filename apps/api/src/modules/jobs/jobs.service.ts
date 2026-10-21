import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { addDays, formatDateBeirut, formatUSD, todayInBeirut } from '@dar/shared';
import { env } from '../../config/env';
import { dateOnly, toCents, toDbDate } from '../../common/money';
import { PrismaService } from '../../common/prisma.service';
import { RentalsService } from '../finance/rentals.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';

/**
 * Background jobs. Every job is idempotent:
 *  - obligation generation relies on UNIQUE(agreementId, periodIndex)
 *  - reminders on UNIQUE(obligationId, reminderKey) + notification dedupeKey
 *  - a JobRun row per job+day prevents overlapping runs across instances
 * Run on ONE instance (JOBS_ENABLED=true) or keep the JobRun lock as the guard.
 *
 * Hosts that put idle apps to sleep (Hostinger, Render free) can miss the
 * 06:05 tick, so the daily job also runs shortly after any start after 06:05. The
 * JobRun lock makes that a no-op when today's run already happened.
 */
@Injectable()
export class JobsService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Jobs');
  constructor(
    private readonly prisma: PrismaService,
    private readonly rentals: RentalsService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
  ) {}

  /** Claims a job slot. Returns false if another instance already ran it today. */
  private async claim(key: string): Promise<boolean> {
    try {
      await this.prisma.jobRun.create({ data: { key } });
      return true;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return false;
      throw e;
    }
  }

  onApplicationBootstrap() {
    if (!env().JOBS_ENABLED || env().NODE_ENV === 'test') return;
    // Before 06:05 Beirut the scheduled tick still lies ahead; don't send reminders at night.
    const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Beirut', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .format(new Date())
      .split(':')
      .map(Number);
    if (h * 60 + m < 6 * 60 + 5) return;
    setTimeout(() => {
      this.daily().catch((e) => this.logger.error(`startup daily run failed: ${e instanceof Error ? e.message : e}`));
    }, 15_000).unref();
  }

  // 06:05 Beirut time daily
  @Cron('5 6 * * *', { timeZone: 'Asia/Beirut' })
  async daily() {
    if (!env().JOBS_ENABLED) return;
    const today = todayInBeirut();
    if (!(await this.claim(`daily:${today}`))) return;
    const ended = await this.rentals.endExpired(today);
    const generated = await this.rentals.generateAll(today);
    const reminders = await this.sendRentReminders(today);
    await this.prisma.jobRun.update({ where: { key: `daily:${today}` }, data: { finishedAt: new Date(), result: { ended, ...generated, reminders } } });
    this.logger.log(`daily ${today}: ended=${ended} generated=${generated.created} reminders=${reminders}`);
  }

  // Retry queued push notifications every 10 minutes.
  @Cron('*/10 * * * *')
  async flushPush() {
    if (!env().JOBS_ENABLED) return;
    await this.notifications.flushQueued();
  }

  /**
   * Rent reminders before and after the due date, as configured. Each
   * (obligation, reminder) pair is recorded so a reminder is never sent twice,
   * even if the job runs again or on several instances.
   */
  async sendRentReminders(today: string): Promise<number> {
    const cfg = await this.settings.reminders();
    let sent = 0;
    const offsets = [...cfg.daysBeforeDue.map((d) => ({ key: `before:${d}`, due: addDays(today, d), tpl: 'rent.reminder.before' })), ...cfg.daysAfterDue.map((d) => ({ key: `after:${d}`, due: addDays(today, -d), tpl: 'rent.reminder.after' }))];
    for (const o of offsets) {
      const obligations = await this.prisma.rentObligation.findMany({
        where: { dueDate: toDbDate(o.due), voidedAt: null, waivedAt: null, agreement: { status: { in: ['ACTIVE', 'ENDED', 'TERMINATED'] } } },
        include: { entries: true, agreement: { select: { tenantId: true, tenant: { select: { locale: true } } } } },
      });
      for (const ob of obligations) {
        const remaining = toCents(ob.totalCents) - ob.entries.reduce((s, e) => s + toCents(e.amountCents), 0);
        if (remaining <= 0) continue;
        try {
          await this.prisma.reminderSend.create({ data: { obligationId: ob.id, reminderKey: o.key } });
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue; // already sent
          throw e;
        }
        const locale = ob.agreement.tenant.locale === 'en' ? 'en' : 'ar';
        await this.notifications.notify({
          userId: ob.agreement.tenantId,
          templateKey: o.tpl,
          vars: { amount: formatUSD(remaining, locale), date: formatDateBeirut(dateOnly(ob.dueDate)!, locale) },
          data: { obligationId: ob.id },
          dedupeKey: `rent.reminder:${ob.id}:${o.key}`,
        });
        sent++;
      }
    }
    return sent;
  }
}
