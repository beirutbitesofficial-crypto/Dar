import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BRAND } from '@dar/shared';
import { env } from '../../config/env';
import { PrismaService } from '../../common/prisma.service';

/**
 * In-app notifications with optional Expo push delivery.
 * - Each notification has a dedupeKey; the same key is never sent twice.
 * - Push status is recorded truthfully: SENT only when Expo accepted the
 *   message, UNCONFIGURED when push is disabled, FAILED with a reason otherwise.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');
  constructor(private readonly prisma: PrismaService) {}

  async notify(input: {
    userId: string;
    templateKey: string;
    vars?: Record<string, string | number>;
    data?: Record<string, string>;
    dedupeKey: string;
  }): Promise<'CREATED' | 'DUPLICATE' | 'SKIPPED'> {
    const [user, template] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: input.userId }, select: { locale: true, anonymizedAt: true } }),
      this.prisma.notificationTemplate.findUnique({ where: { key: input.templateKey } }),
    ]);
    if (!user || user.anonymizedAt || !template || !template.active) return 'SKIPPED';
    const ar = user.locale !== 'en';
    const fill = (s: string) =>
      s.replace(/\{(\w+)\}/g, (_, k) => String(input.vars?.[k] ?? (k === 'brand' ? (ar ? BRAND.name.ar : BRAND.name.en) : '')));

    let notificationId: string;
    try {
      const n = await this.prisma.notification.create({
        data: {
          userId: input.userId,
          templateKey: input.templateKey,
          title: fill(ar ? template.titleAr : template.titleEn),
          body: fill(ar ? template.bodyAr : template.bodyEn),
          data: input.data as any,
          dedupeKey: input.dedupeKey,
          pushStatus: env().PUSH_ENABLED ? 'QUEUED' : 'UNCONFIGURED',
        },
      });
      notificationId = n.id;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return 'DUPLICATE';
      throw e;
    }
    if (env().PUSH_ENABLED) void this.deliver(notificationId).catch(() => undefined);
    return 'CREATED';
  }

  /** Sends one queued notification through Expo's push API. */
  async deliver(notificationId: string) {
    const n = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!n || n.pushStatus !== 'QUEUED') return;
    const tokens = await this.prisma.pushToken.findMany({ where: { userId: n.userId, disabledAt: null }, select: { token: true } });
    if (tokens.length === 0) {
      await this.prisma.notification.update({ where: { id: n.id }, data: { pushStatus: 'NOT_REQUESTED' } });
      return;
    }
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(env().EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env().EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(
          tokens.map((t) => ({ to: t.token, title: n.title, body: n.body, data: n.data ?? {}, sound: 'default', channelId: 'default' })),
        ),
        signal: AbortSignal.timeout(10_000),
      });
      const json: any = await res.json().catch(() => ({}));
      const tickets: any[] = Array.isArray(json?.data) ? json.data : [];
      const okCount = tickets.filter((t) => t?.status === 'ok').length;
      // Disable tokens Expo reports as no longer registered.
      for (let i = 0; i < tickets.length; i++) {
        if (tickets[i]?.details?.error === 'DeviceNotRegistered' && tokens[i]) {
          await this.prisma.pushToken.update({ where: { token: tokens[i]!.token }, data: { disabledAt: new Date() } });
        }
      }
      await this.prisma.notification.update({
        where: { id: n.id },
        data: res.ok && okCount > 0 ? { pushStatus: 'SENT' } : { pushStatus: 'FAILED', pushError: `http_${res.status}_ok_${okCount}` },
      });
    } catch (e) {
      this.logger.warn(`push delivery failed for notification ${n.id}`);
      await this.prisma.notification.update({ where: { id: n.id }, data: { pushStatus: 'FAILED', pushError: 'network' } });
    }
  }

  /** Retries queued pushes (e.g. after a restart). Called by the jobs scheduler. */
  async flushQueued() {
    if (!env().PUSH_ENABLED) return 0;
    const queued = await this.prisma.notification.findMany({ where: { pushStatus: 'QUEUED' }, take: 200, select: { id: true } });
    for (const q of queued) await this.deliver(q.id);
    return queued.length;
  }

  async listMine(userId: string, page = 1) {
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * 30,
        take: 30,
        select: { id: true, title: true, body: true, data: true, readAt: true, createdAt: true, templateKey: true },
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, unread };
  }

  async markRead(userId: string, ids: string[] | 'all') {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...(ids === 'all' ? {} : { id: { in: ids } }) },
      data: { readAt: new Date() },
    });
  }
}
