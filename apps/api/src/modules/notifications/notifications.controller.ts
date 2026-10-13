import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { notificationTemplateSchema } from '@dar/shared';
import { z } from 'zod';
import { CurrentActor, RequestActor, Roles } from '../../common/auth';
import { AuditService } from '../../common/audit.service';
import { PrismaService } from '../../common/prisma.service';
import { zbody } from '../../common/zod.pipe';
import { NotificationsService } from './notifications.service';

const markReadSchema = z.object({ ids: z.array(z.string()).max(200).or(z.literal('all')) });

@Controller('v1')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('me/notifications')
  list(@CurrentActor() actor: RequestActor, @Query('page') page?: string) {
    return this.notifications.listMine(actor.id, Math.max(1, Number(page) || 1));
  }

  @Post('me/notifications/read')
  async read(@CurrentActor() actor: RequestActor, @Body(zbody(markReadSchema)) body: z.infer<typeof markReadSchema>) {
    await this.notifications.markRead(actor.id, body.ids);
    return { ok: true };
  }

  @Roles('ADMIN')
  @Get('admin/notification-templates')
  templates() {
    return this.prisma.notificationTemplate.findMany({ orderBy: { key: 'asc' } });
  }

  @Roles('ADMIN')
  @Put('admin/notification-templates/:key')
  async upsertTemplate(
    @CurrentActor() actor: RequestActor,
    @Param('key') key: string,
    @Body(zbody(notificationTemplateSchema)) body: z.infer<typeof notificationTemplateSchema>,
  ) {
    const { key: _ignored, ...data } = body;
    const t = await this.prisma.notificationTemplate.upsert({ where: { key }, create: { key, ...data }, update: data });
    await this.audit.log({ actorId: actor.id, action: 'template.changed', entityType: 'NotificationTemplate', entityId: key });
    return t;
  }
}
