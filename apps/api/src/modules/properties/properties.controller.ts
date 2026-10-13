import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req } from '@nestjs/common';
import {
  computeRentalBreakdown,
  customerSaleEstimate,
  internalNoteSchema,
  ListingStatus,
  listingSearchSchema,
  mediaReviewSchema,
  moderationDecisionSchema,
  ownerRentalPreview,
  ownerSaleEstimate,
  propertyDraftSchema,
  RentalPricingMode,
  reorderMediaSchema,
  uploadIntentSchema,
  canViewStaffPropertyRecord,
} from '@dar/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { AuditService } from '../../common/audit.service';
import { authorize, CurrentActor, OptionalAuth, Public, RequestActor, Roles } from '../../common/auth';
import { PrismaService } from '../../common/prisma.service';
import { zbody, ZodPipe } from '../../common/zod.pipe';
import { SettingsService } from '../settings/settings.service';
import { ListingsService } from './listings.service';
import { MediaService } from './media.service';
import { ModerationService } from './moderation.service';
import { PropertiesService } from './properties.service';

const transitionSchema = z.object({ to: z.enum(['DRAFT', 'PAUSED', 'PUBLISHED', 'ARCHIVED']) });
const adminTransitionSchema = z.object({
  to: z.enum(['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'PAUSED', 'RENTED', 'SOLD', 'ARCHIVED']),
  reason: z.string().max(500).optional(),
});
const revisionDecisionSchema = z.object({ decision: z.enum(['APPROVE', 'REJECT']), reason: z.string().max(1000).optional() });
const assignSchema = z.object({ employeeId: z.string().min(1) });
const featureSchema = z.object({ featured: z.boolean(), rank: z.number().int().min(0).max(1000).default(0) });
const estimateSchema = z.object({
  type: z.enum(['SALE', 'RENT']),
  amountCents: z.coerce.number().int().min(1),
  mode: z.enum(['NET_PLUS_FEE', 'TOTAL_MINUS_FEE']).optional(),
});

// ---------------------------------------------------------------------------
// Public browsing (visitors allowed)
// ---------------------------------------------------------------------------
@Controller('v1/listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Public()
  @Get()
  search(@Query(new ZodPipe(listingSearchSchema)) q: z.infer<typeof listingSearchSchema>) {
    return this.listings.search(q);
  }

  @Public()
  @Get(':idOrRef')
  get(@Param('idOrRef') idOrRef: string) {
    return this.listings.getOne(idOrRef);
  }
}

@Controller('v1/me/favorites')
export class FavoritesController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  list(@CurrentActor() actor: RequestActor) {
    return this.listings.favorites(actor.id);
  }

  @Get('ids')
  ids(@CurrentActor() actor: RequestActor) {
    return this.listings.favoriteIds(actor.id);
  }

  @HttpCode(204)
  @Put(':propertyId')
  async add(@CurrentActor() actor: RequestActor, @Param('propertyId') propertyId: string) {
    await this.listings.addFavorite(actor.id, propertyId);
  }

  @HttpCode(204)
  @Delete(':propertyId')
  async remove(@CurrentActor() actor: RequestActor, @Param('propertyId') propertyId: string) {
    await this.listings.removeFavorite(actor.id, propertyId);
  }
}

/** Fee estimates computed with the current settings and the same shared functions the apps use. */
@Controller('v1/estimates')
export class EstimatesController {
  constructor(private readonly settings: SettingsService) {}

  @OptionalAuth()
  @Get()
  async estimate(@Query(new ZodPipe(estimateSchema)) q: z.infer<typeof estimateSchema>) {
    const s = await this.settings.current();
    if (q.type === 'SALE') return { owner: ownerSaleEstimate(q.amountCents, s.sale), customer: customerSaleEstimate(q.amountCents, s.sale) };
    const rules = { mode: (q.mode ?? s.rental.mode) as RentalPricingMode, monthlyFeeCents: s.rental.monthlyFeeCents };
    return { owner: ownerRentalPreview(q.amountCents, rules), customer: computeRentalBreakdown(q.amountCents, rules) };
  }
}

// ---------------------------------------------------------------------------
// Owner listing management
// ---------------------------------------------------------------------------
@Controller('v1/owner/properties')
export class OwnerPropertiesController {
  constructor(
    private readonly properties: PropertiesService,
    private readonly media: MediaService,
  ) {}

  @Get()
  list(@CurrentActor() actor: RequestActor) {
    return this.properties.listMine(actor);
  }

  @Post()
  create(@CurrentActor() actor: RequestActor, @Body(zbody(propertyDraftSchema)) body: z.infer<typeof propertyDraftSchema>) {
    return this.properties.createDraft(actor, body);
  }

  @Get(':id')
  get(@CurrentActor() actor: RequestActor, @Param('id') id: string) {
    return this.properties.ownerView(actor, id);
  }

  @Put(':id')
  update(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body(zbody(propertyDraftSchema)) body: z.infer<typeof propertyDraftSchema>) {
    return this.properties.update(actor, id, body);
  }

  @Post(':id/submit')
  submit(@CurrentActor() actor: RequestActor, @Param('id') id: string) {
    return this.properties.submit(actor, id);
  }

  @Post(':id/status')
  transition(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body(zbody(transitionSchema)) body: z.infer<typeof transitionSchema>) {
    return this.properties.ownerTransition(actor, id, body.to);
  }

  @Delete(':id/revision')
  withdrawRevision(@CurrentActor() actor: RequestActor, @Param('id') id: string) {
    return this.properties.withdrawRevision(actor, id);
  }

  @Get(':id/viewing-activity')
  activity(@CurrentActor() actor: RequestActor, @Param('id') id: string) {
    return this.properties.viewingActivity(actor, id);
  }

  @Put(':id/media/order')
  reorder(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body(zbody(reorderMediaSchema)) body: z.infer<typeof reorderMediaSchema>) {
    return this.media.reorder(actor, id, body.orderedIds, body.coverId);
  }
}

@Controller('v1/uploads')
export class UploadsController {
  constructor(private readonly media: MediaService) {}

  @Post()
  intent(@CurrentActor() actor: RequestActor, @Body(zbody(uploadIntentSchema)) body: z.infer<typeof uploadIntentSchema>) {
    return this.media.intent(actor, body);
  }

  @Post(':id/complete')
  complete(@CurrentActor() actor: RequestActor, @Param('id') id: string) {
    return this.media.complete(actor, id);
  }

  @Delete(':id')
  remove(@CurrentActor() actor: RequestActor, @Param('id') id: string) {
    return this.media.remove(actor, id);
  }
}

// ---------------------------------------------------------------------------
// Staff & admin
// ---------------------------------------------------------------------------
@Controller('v1/staff')
@Roles('ADMIN', 'EMPLOYEE')
export class StaffPropertiesController {
  constructor(
    private readonly moderation: ModerationService,
    private readonly media: MediaService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('properties')
  list(
    @CurrentActor() actor: RequestActor,
    @Query('status') status?: ListingStatus,
    @Query('q') q?: string,
    @Query('assignedEmployeeId') assignedEmployeeId?: string,
    @Query('page') page = '1',
  ) {
    return this.moderation.listAll({ status, q, assignedEmployeeId, page: Math.max(1, Number(page) || 1) }, actor);
  }

  @Get('properties/:id')
  get(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Req() req: Request) {
    return this.moderation.staffView(actor, id, req.ip);
  }

  @Post('properties/:id/notes')
  async note(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body(zbody(internalNoteSchema)) body: z.infer<typeof internalNoteSchema>) {
    const p = await this.prisma.property.findUniqueOrThrow({ where: { id }, select: { ownerId: true, assignedEmployeeId: true } });
    authorize(canViewStaffPropertyRecord(actor, p));
    return this.prisma.internalNote.create({ data: { entityType: 'PROPERTY', entityId: id, authorId: actor.id, body: body.body } });
  }

  @Post('properties/:id/status')
  transition(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body(zbody(adminTransitionSchema)) body: z.infer<typeof adminTransitionSchema>) {
    return this.moderation.adminTransition(actor, id, body.to, body.reason);
  }

  @Get('documents/:mediaId')
  async document(@CurrentActor() actor: RequestActor, @Param('mediaId') mediaId: string, @Req() req: Request) {
    const r = await this.media.documentUrl(actor, mediaId);
    await this.audit.log({ actorId: actor.id, action: 'sensitive.document_viewed', entityType: 'Media', entityId: mediaId, ip: req.ip });
    return { url: r.url, expiresInSeconds: 120 };
  }
}

@Controller('v1/admin/moderation')
@Roles('ADMIN')
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Get()
  queue() {
    return this.moderation.queue();
  }

  @Post('properties/:id/decision')
  decide(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body(zbody(moderationDecisionSchema)) body: z.infer<typeof moderationDecisionSchema>) {
    return body.decision === 'APPROVE'
      ? this.moderation.approve(actor, id, { assignedEmployeeId: body.assignedEmployeeId, featured: body.featured })
      : this.moderation.reject(actor, id, body.reason);
  }

  @Post('revisions/:id/decision')
  revision(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body(zbody(revisionDecisionSchema)) body: z.infer<typeof revisionDecisionSchema>) {
    return this.moderation.decideRevision(actor, id, body.decision, body.reason);
  }

  @Post('media')
  media(@CurrentActor() actor: RequestActor, @Body(zbody(mediaReviewSchema)) body: z.infer<typeof mediaReviewSchema>) {
    return this.moderation.reviewMedia(actor, body.mediaId, body.decision, body.reason);
  }

  @Put('properties/:id/assignee')
  assign(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body(zbody(assignSchema)) body: z.infer<typeof assignSchema>) {
    return this.moderation.assign(actor, id, body.employeeId);
  }

  @Put('properties/:id/featured')
  feature(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body(zbody(featureSchema)) body: z.infer<typeof featureSchema>) {
    return this.moderation.feature(actor, id, body.featured, body.rank);
  }
}
