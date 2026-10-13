import { BadRequestException, Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { LocationNode, locationSchema } from '@dar/shared';
import { z } from 'zod';
import { AuditService } from '../../common/audit.service';
import { CurrentActor, Public, RequestActor, Roles } from '../../common/auth';
import { PrismaService } from '../../common/prisma.service';
import { zbody } from '../../common/zod.pipe';

const amenitySchema = z.object({
  labelAr: z.string().min(1).max(60),
  labelEn: z.string().min(1).max(60),
  appliesTo: z.array(z.enum(['APARTMENT', 'HOUSE_VILLA', 'LAND', 'COMMERCIAL'])).min(1),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').slice(0, 60);

@Controller('v1')
export class LocationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Public directory of launch areas → towns → neighborhoods (active only). */
  @Public()
  @Get('locations')
  async list(): Promise<LocationNode[]> {
    const rows = await this.prisma.location.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }] });
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      nameAr: r.nameAr,
      nameEn: r.nameEn,
      parentId: r.parentId,
      lat: r.lat ? Number(r.lat) : null,
      lng: r.lng ? Number(r.lng) : null,
      active: r.active,
      sortOrder: r.sortOrder,
    }));
  }

  @Public()
  @Get('amenities')
  amenities() {
    return this.prisma.amenity.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
  }

  @Roles('ADMIN')
  @Get('admin/locations')
  all() {
    return this.prisma.location.findMany({
      orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }],
      include: { _count: { select: { townProperties: true } } },
    });
  }

  @Roles('ADMIN')
  @Post('admin/locations')
  async create(@CurrentActor() actor: RequestActor, @Body(zbody(locationSchema)) body: z.infer<typeof locationSchema>) {
    await this.checkParent(body.kind, body.parentId ?? null);
    const loc = await this.prisma.location.create({
      data: { ...body, slug: `${slugify(body.nameEn)}-${Date.now().toString(36)}`, parentId: body.parentId ?? null },
    });
    await this.audit.log({ actorId: actor.id, action: 'location.changed', entityType: 'Location', entityId: loc.id, metadata: { op: 'create' } });
    return loc;
  }

  @Roles('ADMIN')
  @Put('admin/locations/:id')
  async update(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body(zbody(locationSchema)) body: z.infer<typeof locationSchema>) {
    await this.checkParent(body.kind, body.parentId ?? null);
    // Locations are deactivated, not deleted, so existing listings keep their references.
    const loc = await this.prisma.location.update({ where: { id }, data: { ...body, parentId: body.parentId ?? null } });
    await this.audit.log({ actorId: actor.id, action: 'location.changed', entityType: 'Location', entityId: id, metadata: { op: 'update' } });
    return loc;
  }

  @Roles('ADMIN')
  @Get('admin/amenities')
  allAmenities() {
    return this.prisma.amenity.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  @Roles('ADMIN')
  @Put('admin/amenities/:key')
  upsertAmenity(@Param('key') key: string, @Body(zbody(amenitySchema)) body: z.infer<typeof amenitySchema>) {
    if (!/^[a-z0-9_]{2,40}$/.test(key)) throw new BadRequestException({ code: 'AMENITY_KEY_INVALID', message: 'Invalid key' });
    return this.prisma.amenity.upsert({ where: { key }, create: { key, ...body }, update: body });
  }

  private async checkParent(kind: 'AREA' | 'TOWN' | 'NEIGHBORHOOD', parentId: string | null) {
    const expected = kind === 'AREA' ? null : kind === 'TOWN' ? 'AREA' : 'TOWN';
    if (expected === null) {
      if (parentId) throw new BadRequestException({ code: 'LOCATION_PARENT_INVALID', message: 'Areas have no parent' });
      return;
    }
    const parent = parentId ? await this.prisma.location.findUnique({ where: { id: parentId } }) : null;
    if (!parent || parent.kind !== expected) {
      throw new BadRequestException({ code: 'LOCATION_PARENT_INVALID', message: `A ${kind.toLowerCase()} must belong to a ${expected.toLowerCase()}` });
    }
  }
}
