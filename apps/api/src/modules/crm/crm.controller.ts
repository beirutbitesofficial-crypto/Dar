import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  confirmViewingSchema,
  internalNoteSchema,
  leadAssignSchema,
  leadTransitionSchema,
  LeadStatus,
  offerSchema,
  reportSchema,
  rescheduleViewingSchema,
  sendMessageSchema,
  startConversationSchema,
  viewingOutcomeSchema,
  viewingRequestSchema,
} from '@dar/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { AuditService } from '../../common/audit.service';
import { CurrentActor, Public, RequestActor, Roles } from '../../common/auth';
import { PrismaService } from '../../common/prisma.service';
import { zbody } from '../../common/zod.pipe';
import { ConversationsService } from './conversations.service';
import { LeadsService } from './leads.service';
import { ViewingsService } from './viewings.service';

const hideSchema = z.object({ reason: z.string().min(3).max(500) });
const resolveSchema = z.object({ status: z.enum(['RESOLVED', 'DISMISSED']), resolution: z.string().min(3).max(1000), blockUser: z.boolean().default(false) });

@Controller('v1')
export class CustomerCrmController {
  constructor(
    private readonly viewings: ViewingsService,
    private readonly conversations: ConversationsService,
    private readonly prisma: PrismaService,
  ) {}

  /** The disclosure a customer must see and accept before requesting a viewing. */
  @Public()
  @Get('listings/:id/viewing-terms')
  terms(@Param('id') id: string) {
    return this.viewings.currentDisclosure(id);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('viewings')
  request(@CurrentActor() actor: RequestActor, @Body(zbody(viewingRequestSchema)) body: z.infer<typeof viewingRequestSchema>) {
    return this.viewings.request(actor, body);
  }

  @Get('me/viewings')
  mine(@CurrentActor() actor: RequestActor) {
    return this.viewings.listMine(actor);
  }

  @Put('me/viewings/:id')
  reschedule(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body(zbody(rescheduleViewingSchema)) body: z.infer<typeof rescheduleViewingSchema>) {
    return this.viewings.reschedule(actor, id, body.preferredSlots, body.customerNotes);
  }

  @Post('me/viewings/:id/cancel')
  cancel(@CurrentActor() actor: RequestActor, @Param('id') id: string) {
    return this.viewings.cancelByCustomer(actor, id);
  }

  @Get('conversations')
  conversationsList(@CurrentActor() actor: RequestActor, @Query('scope') scope?: string, @Query('page') page?: string) {
    return this.conversations.list(actor, { staffScope: scope === 'staff', page: Math.max(1, Number(page) || 1) });
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('conversations')
  start(@CurrentActor() actor: RequestActor, @Body(zbody(startConversationSchema)) body: z.infer<typeof startConversationSchema>) {
    return this.conversations.start(actor, body);
  }

  @Get('conversations/:id/messages')
  messages(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Query('before') before?: string) {
    return this.conversations.messages(actor, id, before);
  }

  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @Post('conversations/:id/messages')
  send(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body(zbody(sendMessageSchema)) body: z.infer<typeof sendMessageSchema>) {
    return this.conversations.send(actor, id, body);
  }

  @HttpCode(204)
  @Post('conversations/:id/read')
  async read(@CurrentActor() actor: RequestActor, @Param('id') id: string) {
    await this.conversations.markRead(actor, id);
  }

  /** Report a listing, message or user. */
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @Post('reports')
  async report(@CurrentActor() actor: RequestActor, @Body(zbody(reportSchema)) body: z.infer<typeof reportSchema>) {
    const exists =
      body.targetType === 'LISTING'
        ? await this.prisma.property.count({ where: { id: body.targetId } })
        : body.targetType === 'MESSAGE'
          ? await this.prisma.message.count({ where: { id: body.targetId, conversation: { OR: [{ customerId: actor.id }, { assignedEmployeeId: actor.id }] } } })
          : await this.prisma.user.count({ where: { id: body.targetId } });
    if (!exists) throw new BadRequestException({ code: 'REPORT_TARGET_INVALID', message: 'Nothing to report' });
    await this.prisma.report.create({ data: { reporterId: actor.id, ...body } });
    return { ok: true };
  }
}

@Controller('v1/staff')
@Roles('ADMIN', 'EMPLOYEE')
export class StaffCrmController {
  constructor(
    private readonly viewings: ViewingsService,
    private readonly leads: LeadsService,
    private readonly conversations: ConversationsService,
  ) {}

  @Get('viewings/requests')
  queue(@CurrentActor() actor: RequestActor) {
    return this.viewings.staffQueue(actor);
  }

  @Get('viewings/calendar')
  calendar(@CurrentActor() actor: RequestActor, @Query('from') from: string, @Query('to') to: string, @Query('employeeId') employeeId?: string) {
    const f = new Date(from);
    const t = new Date(to);
    if (isNaN(f.getTime()) || isNaN(t.getTime()) || t <= f || t.getTime() - f.getTime() > 62 * 86_400_000) {
      throw new BadRequestException({ code: 'RANGE_INVALID', message: 'Invalid range (max 62 days)' });
    }
    return this.viewings.calendar(actor, f, t, employeeId);
  }

  @Post('viewings/:id/confirm')
  confirm(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body(zbody(confirmViewingSchema)) body: z.infer<typeof confirmViewingSchema>) {
    return this.viewings.confirm(actor, id, body);
  }

  @Post('viewings/:id/outcome')
  outcome(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body(zbody(viewingOutcomeSchema)) body: z.infer<typeof viewingOutcomeSchema>) {
    return this.viewings.outcome(actor, id, body.status, body.notes);
  }

  @Get('leads')
  leadsList(@CurrentActor() actor: RequestActor, @Query('status') status?: LeadStatus, @Query('employeeId') employeeId?: string, @Query('page') page?: string) {
    return this.leads.list(actor, { status, employeeId, page: Math.max(1, Number(page) || 1) });
  }

  @Get('leads/pipeline')
  pipeline(@CurrentActor() actor: RequestActor) {
    return this.leads.pipeline(actor);
  }

  @Get('leads/:id')
  lead(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Req() req: Request) {
    return this.leads.detail(actor, id, req.ip);
  }

  @Post('leads/:id/status')
  transition(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body(zbody(leadTransitionSchema)) body: z.infer<typeof leadTransitionSchema>) {
    return this.leads.transition(actor, id, body.to, body.reason);
  }

  @Roles('ADMIN')
  @Put('leads/:id/assignee')
  assign(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body(zbody(leadAssignSchema)) body: z.infer<typeof leadAssignSchema>) {
    return this.leads.assign(actor, id, body.employeeId, body.expectedVersion);
  }

  @Post('leads/:id/notes')
  note(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body(zbody(internalNoteSchema)) body: z.infer<typeof internalNoteSchema>) {
    return this.leads.addNote(actor, id, body.body);
  }

  @Post('leads/:id/offers')
  offer(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body(zbody(offerSchema)) body: z.infer<typeof offerSchema>) {
    return this.leads.addOffer(actor, id, body);
  }

  @Get('conversations/:id/notes')
  notes(@CurrentActor() actor: RequestActor, @Param('id') id: string) {
    return this.conversations.internalNotes(actor, id);
  }

  @Post('conversations/:id/notes')
  addNote(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body(zbody(internalNoteSchema)) body: z.infer<typeof internalNoteSchema>) {
    return this.conversations.addInternalNote(actor, id, body.body);
  }

  @Post('messages/:id/hide')
  hide(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body(zbody(hideSchema)) body: z.infer<typeof hideSchema>) {
    return this.conversations.hideMessage(actor, id, body.reason);
  }
}

@Controller('v1/admin/reports')
@Roles('ADMIN')
export class ReportsAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Query('status') status = 'OPEN') {
    return this.prisma.report.findMany({
      where: { status: status as any },
      orderBy: { createdAt: 'asc' },
      include: { reporter: { select: { id: true, fullName: true } } },
      take: 200,
    });
  }

  /** Resolve a report; optionally block the offending user (revokes sessions). */
  @Post(':id/resolve')
  async resolve(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body(zbody(resolveSchema)) body: z.infer<typeof resolveSchema>) {
    const report = await this.prisma.report.findUniqueOrThrow({ where: { id } });
    await this.prisma.$transaction(async (tx) => {
      await tx.report.update({ where: { id }, data: { status: body.status, resolution: body.resolution, resolvedById: actor.id, resolvedAt: new Date() } });
      if (body.blockUser) {
        let userId: string | null = null;
        if (report.targetType === 'USER') userId = report.targetId;
        if (report.targetType === 'MESSAGE') userId = (await tx.message.findUnique({ where: { id: report.targetId }, select: { senderId: true } }))?.senderId ?? null;
        if (report.targetType === 'LISTING') userId = (await tx.property.findUnique({ where: { id: report.targetId }, select: { ownerId: true } }))?.ownerId ?? null;
        if (userId) {
          await tx.user.update({ where: { id: userId }, data: { blocked: true, blockedReason: body.resolution } });
          await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: 'blocked' } });
          await this.audit.log({ actorId: actor.id, action: 'user.blocked', entityType: 'User', entityId: userId, metadata: { reportId: id } }, tx);
        }
      }
      await this.audit.log({ actorId: actor.id, action: 'report.resolved', entityType: 'Report', entityId: id, metadata: { status: body.status } }, tx);
    });
    return { ok: true };
  }
}
