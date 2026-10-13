import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { deletionRequestSchema, maskEmail, pushTokenSchema, Role, updateProfileSchema, userRoleUpdateSchema } from '@dar/shared';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { AuditService } from '../../common/audit.service';
import { CurrentActor, RequestActor, Roles } from '../../common/auth';
import { PrismaService } from '../../common/prisma.service';
import { zbody } from '../../common/zod.pipe';

@Controller('v1')
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Put('me')
  async updateProfile(@CurrentActor() actor: RequestActor, @Body(zbody(updateProfileSchema)) body: z.infer<typeof updateProfileSchema>) {
    const current = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { phone: true } });
    await this.prisma.user.update({
      where: { id: actor.id },
      data: {
        ...body,
        // Changing the number clears any previous verification.
        ...(body.phone && body.phone !== current.phone ? { phoneVerifiedAt: null } : {}),
      },
    });
    return { ok: true };
  }

  @Post('me/push-tokens')
  async registerPush(@CurrentActor() actor: RequestActor, @Body(zbody(pushTokenSchema)) body: z.infer<typeof pushTokenSchema>) {
    await this.prisma.pushToken.upsert({
      where: { token: body.token },
      create: { token: body.token, platform: body.platform, userId: actor.id },
      update: { userId: actor.id, platform: body.platform, lastSeenAt: new Date(), disabledAt: null },
    });
    return { ok: true };
  }

  @HttpCode(204)
  @Delete('me/push-tokens/:token')
  async removePush(@CurrentActor() actor: RequestActor, @Param('token') token: string) {
    await this.prisma.pushToken.updateMany({ where: { token, userId: actor.id }, data: { disabledAt: new Date() } });
  }

  /**
   * Account deletion request. Retention workflow (docs/PRIVACY_RETENTION.md):
   * staff review open obligations, then anonymize personal data. Financial
   * records (agreements, payments, payouts, receipts) are retained with the
   * user's name replaced, for the legally required period.
   */
  @Post('me/deletion-request')
  async requestDeletion(@CurrentActor() actor: RequestActor, @Body(zbody(deletionRequestSchema)) body: z.infer<typeof deletionRequestSchema>) {
    const existing = await this.prisma.accountDeletionRequest.findFirst({ where: { userId: actor.id, status: 'PENDING' } });
    if (!existing) {
      await this.prisma.$transaction([
        this.prisma.accountDeletionRequest.create({ data: { userId: actor.id, reason: body.reason } }),
        this.prisma.user.update({ where: { id: actor.id }, data: { deletionRequestedAt: new Date() } }),
      ]);
      await this.audit.log({ actorId: actor.id, action: 'user.deletion_requested', entityType: 'User', entityId: actor.id });
    }
    return { status: 'PENDING' };
  }

  // ---------------------------------------------------------------- admin

  @Roles('ADMIN')
  @Get('admin/users')
  async list(@Query('q') q?: string, @Query('role') role?: Role, @Query('page') page = '1') {
    const where = {
      anonymizedAt: null,
      ...(role ? { roles: { has: role } } : {}),
      ...(q ? { OR: [{ fullName: { contains: q, mode: 'insensitive' as const } }, { email: { contains: q.toLowerCase() } }] } : {}),
    };
    const p = Math.max(1, Number(page) || 1);
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * 50,
        take: 50,
        select: {
          id: true, fullName: true, email: true, phone: true, phoneVerifiedAt: true, roles: true, blocked: true,
          canRecordCollections: true, deletionRequestedAt: true, demo: true, createdAt: true,
          _count: { select: { assignedLeads: { where: { status: { notIn: ['WON', 'LOST'] } } }, assignedProperties: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: p, pageSize: 50 };
  }

  @Roles('ADMIN')
  @Get('admin/employees')
  employees() {
    return this.prisma.user.findMany({
      where: { roles: { has: 'EMPLOYEE' }, blocked: false, anonymizedAt: null },
      select: {
        id: true, fullName: true, canRecordCollections: true,
        _count: {
          select: {
            assignedLeads: { where: { status: { notIn: ['WON', 'LOST'] } } },
            assignedProperties: { where: { status: { in: ['PUBLISHED', 'PENDING_REVIEW', 'PAUSED'] } } },
            assignedViewings: { where: { status: 'CONFIRMED', scheduledAt: { gte: new Date() } } },
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });
  }

  @Roles('ADMIN')
  @Put('admin/users/:id/roles')
  async updateRoles(
    @CurrentActor() actor: RequestActor,
    @Param('id') id: string,
    @Body(zbody(userRoleUpdateSchema)) body: z.infer<typeof userRoleUpdateSchema>,
  ) {
    if (id === actor.id && !body.roles.includes('ADMIN')) {
      throw new BadRequestException({ code: 'CANNOT_REMOVE_OWN_ADMIN', message: 'You cannot remove your own admin role' });
    }
    const before = await this.prisma.user.findUniqueOrThrow({ where: { id }, select: { roles: true, blocked: true, canRecordCollections: true } });
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { roles: body.roles, canRecordCollections: body.canRecordCollections ?? before.canRecordCollections, blocked: body.blocked ?? before.blocked, blockedReason: body.blocked ? body.reason : null },
      });
      if (body.blocked && !before.blocked) {
        await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: 'blocked' } });
      }
      await this.audit.log(
        {
          actorId: actor.id,
          action: body.blocked !== undefined && body.blocked !== before.blocked ? (body.blocked ? 'user.blocked' : 'user.unblocked') : 'user.roles_changed',
          entityType: 'User',
          entityId: id,
          metadata: { from: before, to: { roles: body.roles, canRecordCollections: body.canRecordCollections, blocked: body.blocked }, reason: body.reason },
        },
        tx,
      );
    });
    return { ok: true };
  }

  @Roles('ADMIN')
  @Get('admin/deletion-requests')
  deletionRequests() {
    return this.prisma.accountDeletionRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { requestedAt: 'asc' },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
  }

  /** Anonymizes a user after review. Blocked while they have active agreements or open balances. */
  @Roles('ADMIN')
  @Post('admin/deletion-requests/:id/complete')
  async completeDeletion(@CurrentActor() actor: RequestActor, @Param('id') id: string) {
    const req = await this.prisma.accountDeletionRequest.findUniqueOrThrow({ where: { id } });
    const activeAgreements = await this.prisma.rentalAgreement.count({
      where: { status: 'ACTIVE', OR: [{ landlordId: req.userId }, { tenantId: req.userId }] },
    });
    if (activeAgreements > 0) {
      throw new BadRequestException({ code: 'ACTIVE_AGREEMENTS', message: 'End or terminate active agreements before anonymizing' });
    }
    const placeholder = `deleted-${randomBytes(6).toString('hex')}@deleted.invalid`;
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: req.userId },
        data: {
          email: placeholder,
          fullName: 'Deleted user',
          phone: null,
          phoneVerifiedAt: null,
          passwordHash: randomBytes(32).toString('hex'),
          anonymizedAt: new Date(),
          blocked: true,
        },
      });
      await tx.session.updateMany({ where: { userId: req.userId, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: 'deleted' } });
      await tx.pushToken.deleteMany({ where: { userId: req.userId } });
      await tx.favorite.deleteMany({ where: { userId: req.userId } });
      // Owner contact fields entered on their listings are private personal data too.
      await tx.property.updateMany({
        where: { ownerId: req.userId },
        data: { ownerContactName: null, ownerContactPhone: null, ownerContactEmail: null, ownerNotesForStaff: null },
      });
      await tx.accountDeletionRequest.update({ where: { id }, data: { status: 'COMPLETED', processedAt: new Date(), processedById: actor.id } });
      await this.audit.log({ actorId: actor.id, action: 'user.anonymized', entityType: 'User', entityId: req.userId, metadata: { email: maskEmail(placeholder) } }, tx);
    });
    return { ok: true };
  }
}
