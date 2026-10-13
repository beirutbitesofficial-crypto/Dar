import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { canAccessConversation, ConversationSummary, isAdmin, isStaff, MessageDto } from '@dar/shared';
import { AuditService } from '../../common/audit.service';
import { authorize, RequestActor } from '../../common/auth';
import { ref } from '../../common/money';
import { PrismaService } from '../../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MediaService } from '../properties/media.service';
import { ViewingsService } from './viewings.service';

/**
 * Conversations are always between a customer and OUR STAFF. There is no
 * owner–customer channel. Internal staff notes live in a separate table and
 * are never returned by these endpoints.
 */
@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly media: MediaService,
    private readonly viewings: ViewingsService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: RequestActor, opts: { staffScope?: boolean; page?: number }): Promise<ConversationSummary[]> {
    const where: Prisma.ConversationWhereInput =
      opts.staffScope && isStaff(actor) ? (isAdmin(actor) ? {} : { assignedEmployeeId: actor.id }) : { customerId: actor.id };
    const rows = await this.prisma.conversation.findMany({
      where,
      orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
      skip: ((opts.page ?? 1) - 1) * 30,
      take: 30,
      include: {
        property: { select: { refNo: true } },
        assignedEmployee: { select: { fullName: true } },
        customer: { select: { fullName: true } },
        reads: { where: { userId: actor.id } },
        messages: { where: { hiddenAt: null }, orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, senderRole: true } },
      },
    });
    return Promise.all(
      rows.map(async (c) => {
        const lastRead = c.reads[0]?.lastReadAt ?? new Date(0);
        const unread = await this.prisma.message.count({
          where: { conversationId: c.id, createdAt: { gt: lastRead }, senderId: { not: actor.id }, hiddenAt: null },
        });
        const last = c.messages[0];
        return {
          id: c.id,
          subject: opts.staffScope ? `${c.subject} · ${c.customer.fullName}` : c.subject,
          propertyRef: c.property ? ref('DAR', c.property.refNo) : null,
          lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
          lastMessagePreview: last ? (last.senderRole === 'SYSTEM' ? null : last.body.slice(0, 120)) : null,
          unreadCount: unread,
          staffName: c.assignedEmployee?.fullName ?? null,
        };
      }),
    );
  }

  /** Customer starts a conversation, optionally about a listing (creates/joins the lead). */
  async start(actor: RequestActor, input: { propertyId?: string; subject?: string; body: string; clientMessageId: string }) {
    const prior = await this.prisma.message.findUnique({ where: { senderId_clientMessageId: { senderId: actor.id, clientMessageId: input.clientMessageId } } });
    if (prior) return { conversationId: prior.conversationId };
    let conversationId: string;
    if (input.propertyId) {
      const p = await this.prisma.property.findFirst({ where: { id: input.propertyId, status: 'PUBLISHED' }, select: { id: true, refNo: true, assignedEmployeeId: true, ownerId: true } });
      if (!p) throw new NotFoundException();
      if (p.ownerId === actor.id) throw new BadRequestException({ code: 'OWN_LISTING', message: 'This is your own listing' });
      conversationId = await this.prisma.$transaction(async (tx) => {
        const lead = await this.viewings.openLead(tx, actor.id, p.id, p.assignedEmployeeId, 'MESSAGE');
        let conv = await tx.conversation.findFirst({ where: { customerId: actor.id, leadId: lead.id } });
        conv ??= await tx.conversation.create({
          data: { customerId: actor.id, leadId: lead.id, propertyId: p.id, assignedEmployeeId: lead.assignedEmployeeId, subject: ref('DAR', p.refNo) },
        });
        return conv.id;
      });
    } else {
      const conv = await this.prisma.conversation.create({ data: { customerId: actor.id, subject: input.subject?.trim() || 'General' } });
      conversationId = conv.id;
    }
    await this.send(actor, conversationId, { body: input.body, attachmentIds: [], clientMessageId: input.clientMessageId });
    return { conversationId };
  }

  async messages(actor: RequestActor, conversationId: string, before?: string): Promise<MessageDto[]> {
    const conv = await this.load(conversationId);
    authorize(canAccessConversation(actor, conv));
    const rows = await this.prisma.message.findMany({
      where: { conversationId, hiddenAt: null, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { sender: { select: { fullName: true } }, attachments: { where: { removedAt: null, status: 'READY' } } },
    });
    const urls = await this.media.urls(rows.flatMap((m) => m.attachments));
    return rows.reverse().map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderRole === 'STAFF' ? 'staff' : m.senderId, // staff identity reduced to a display name
      senderRole: m.senderRole,
      senderName: m.senderRole === 'STAFF' ? m.sender.fullName.split(' ')[0]! : m.senderRole === 'SYSTEM' ? '' : m.sender.fullName,
      body: m.body,
      attachments: m.attachments.map((a) => ({ id: a.id, fileName: a.fileName, mimeType: a.mimeType, url: urls.get(a.id) ?? '' })),
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async send(actor: RequestActor, conversationId: string, input: { body: string; attachmentIds: string[]; clientMessageId: string }) {
    const conv = await this.load(conversationId);
    authorize(canAccessConversation(actor, conv));
    if (conv.closedAt) throw new BadRequestException({ code: 'CONVERSATION_CLOSED', message: 'Conversation closed' });
    const senderRole = actor.id === conv.customerId ? 'CUSTOMER' : 'STAFF';
    const existing = await this.prisma.message.findUnique({ where: { senderId_clientMessageId: { senderId: actor.id, clientMessageId: input.clientMessageId } } });
    if (existing) return { id: existing.id, duplicate: true }; // safe client retry
    if (input.attachmentIds.length) {
      const owned = await this.prisma.media.count({
        where: { id: { in: input.attachmentIds }, uploaderId: actor.id, kind: 'MESSAGE_ATTACHMENT', status: 'READY', messageId: null },
      });
      if (owned !== input.attachmentIds.length) throw new BadRequestException({ code: 'ATTACHMENT_INVALID', message: 'Invalid attachment' });
    }
    const msg = await this.prisma.$transaction(async (tx) => {
      const m = await tx.message.create({ data: { conversationId, senderId: actor.id, senderRole, body: input.body, clientMessageId: input.clientMessageId } });
      if (input.attachmentIds.length) await tx.media.updateMany({ where: { id: { in: input.attachmentIds } }, data: { messageId: m.id } });
      await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: m.createdAt } });
      await tx.conversationRead.upsert({
        where: { conversationId_userId: { conversationId, userId: actor.id } },
        create: { conversationId, userId: actor.id, lastReadAt: m.createdAt },
        update: { lastReadAt: m.createdAt },
      });
      return m;
    });
    const recipient = senderRole === 'CUSTOMER' ? conv.assignedEmployeeId : conv.customerId;
    if (recipient) {
      await this.notifications.notify({
        userId: recipient,
        templateKey: senderRole === 'CUSTOMER' ? 'staff.new_message' : 'message.new',
        data: { conversationId },
        // One push per conversation per 10-minute window to avoid notification spam.
        dedupeKey: `message:${conversationId}:${recipient}:${Math.floor(Date.now() / 600_000)}`,
      });
    }
    return { id: msg.id, duplicate: false };
  }

  async markRead(actor: RequestActor, conversationId: string) {
    const conv = await this.load(conversationId);
    authorize(canAccessConversation(actor, conv));
    await this.prisma.conversationRead.upsert({
      where: { conversationId_userId: { conversationId, userId: actor.id } },
      create: { conversationId, userId: actor.id, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    });
  }

  async addInternalNote(actor: RequestActor, conversationId: string, body: string) {
    const conv = await this.load(conversationId);
    authorize(isAdmin(actor) || (isStaff(actor) && conv.assignedEmployeeId === actor.id));
    return this.prisma.internalNote.create({ data: { entityType: 'CONVERSATION', entityId: conversationId, authorId: actor.id, body } });
  }

  async internalNotes(actor: RequestActor, conversationId: string) {
    const conv = await this.load(conversationId);
    authorize(isAdmin(actor) || (isStaff(actor) && conv.assignedEmployeeId === actor.id));
    return this.prisma.internalNote.findMany({ where: { entityType: 'CONVERSATION', entityId: conversationId }, orderBy: { createdAt: 'desc' } });
  }

  async hideMessage(actor: RequestActor, messageId: string, reason: string) {
    const m = await this.prisma.message.findUniqueOrThrow({ where: { id: messageId }, include: { conversation: true } });
    authorize(isAdmin(actor) || (isStaff(actor) && m.conversation.assignedEmployeeId === actor.id));
    await this.prisma.message.update({ where: { id: messageId }, data: { hiddenAt: new Date(), hiddenById: actor.id, hiddenReason: reason } });
    await this.audit.log({ actorId: actor.id, action: 'message.hidden', entityType: 'Message', entityId: messageId, metadata: { reason } });
    return { ok: true };
  }

  private async load(id: string) {
    const c = await this.prisma.conversation.findUnique({ where: { id } });
    if (!c) throw new NotFoundException();
    return c;
  }
}
