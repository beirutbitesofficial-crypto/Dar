import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  assertNoPrivateFields,
  ListingSearchInput,
  Page,
  PublicListing,
  PublicPhoto,
  toPublicListing,
} from '@dar/shared';
import { dateOnly, ref, toCents } from '../../common/money';
import { PrismaService } from '../../common/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { LocationCache } from './location-cache.service';
import { MediaService } from './media.service';

/** Columns a public query may read. Private columns are never selected. */
const PUBLIC_SELECT = {
  id: true,
  refNo: true,
  status: true,
  approvedAt: true,
  listingType: true,
  propertyType: true,
  titleAr: true,
  titleEn: true,
  descriptionAr: true,
  descriptionEn: true,
  areaId: true,
  townId: true,
  neighborhoodId: true,
  priceCents: true,
  rentPricingMode: true,
  sizeSqm: true,
  bedrooms: true,
  bathrooms: true,
  floor: true,
  totalFloors: true,
  furnished: true,
  amenities: true,
  availableFrom: true,
  featured: true,
  publishedAt: true,
  demo: true,
} satisfies Prisma.PropertySelect;

const PUBLIC_PHOTO_WHERE = { kind: 'PHOTO' as const, status: 'READY' as const, reviewStatus: 'APPROVED' as const, removedAt: null };

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly locations: LocationCache,
    private readonly settings: SettingsService,
  ) {}

  /** Only approved, published listings are ever returned. */
  private publicWhere(): Prisma.PropertyWhereInput {
    return { status: 'PUBLISHED', approvedAt: { not: null } };
  }

  async search(q: ListingSearchInput): Promise<Page<PublicListing>> {
    const and: Prisma.PropertyWhereInput[] = [this.publicWhere()];
    if (q.listingType) and.push({ listingType: q.listingType });
    if (q.propertyType?.length) and.push({ propertyType: { in: q.propertyType } });
    if (q.areaId) and.push({ areaId: q.areaId });
    if (q.townId) and.push({ townId: q.townId });
    if (q.minPriceCents !== undefined) and.push({ priceCents: { gte: BigInt(q.minPriceCents) } });
    if (q.maxPriceCents !== undefined) and.push({ priceCents: { lte: BigInt(q.maxPriceCents) } });
    if (q.minSizeSqm !== undefined) and.push({ sizeSqm: { gte: q.minSizeSqm } });
    if (q.maxSizeSqm !== undefined) and.push({ sizeSqm: { lte: q.maxSizeSqm } });
    if (q.minBedrooms !== undefined) and.push({ bedrooms: { gte: q.minBedrooms } });
    if (q.furnished !== undefined) and.push({ furnished: q.furnished });
    if (q.amenities?.length) and.push({ amenities: { hasEvery: q.amenities } });
    if (q.featured) and.push({ featured: true });
    if (q.q) {
      and.push({
        OR: [
          { titleAr: { contains: q.q, mode: 'insensitive' } },
          { titleEn: { contains: q.q, mode: 'insensitive' } },
          { town: { OR: [{ nameAr: { contains: q.q } }, { nameEn: { contains: q.q, mode: 'insensitive' } }] } },
          { area: { OR: [{ nameAr: { contains: q.q } }, { nameEn: { contains: q.q, mode: 'insensitive' } }] } },
        ],
      });
    }
    const orderBy: Prisma.PropertyOrderByWithRelationInput[] =
      q.sort === 'price_asc'
        ? [{ priceCents: 'asc' }, { id: 'asc' }]
        : q.sort === 'price_desc'
          ? [{ priceCents: 'desc' }, { id: 'asc' }]
          : q.sort === 'size_desc'
            ? [{ sizeSqm: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }]
            : q.featured
              ? [{ featuredRank: 'asc' }, { publishedAt: 'desc' }]
              : [{ publishedAt: 'desc' }, { id: 'asc' }];
    const where = { AND: and };
    const [rows, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: { ...PUBLIC_SELECT, media: { where: { ...PUBLIC_PHOTO_WHERE, isCover: true }, take: 1, select: { id: true, storageKey: true, width: true, height: true, isCover: true } } },
      }),
      this.prisma.property.count({ where }),
    ]);
    const items = await this.serialize(rows);
    const page = { items, page: q.page, pageSize: q.pageSize, total };
    assertNoPrivateFields(page);
    return page;
  }

  async getOne(idOrRef: string): Promise<PublicListing> {
    const refMatch = /^DAR-(\d+)$/i.exec(idOrRef);
    const where: Prisma.PropertyWhereInput = {
      ...this.publicWhere(),
      ...(refMatch ? { refNo: Number(refMatch[1]) - 1000 } : { id: idOrRef }),
    };
    const row = await this.prisma.property.findFirst({
      where,
      select: { ...PUBLIC_SELECT, media: { where: PUBLIC_PHOTO_WHERE, orderBy: { sortOrder: 'asc' }, select: { id: true, storageKey: true, width: true, height: true, isCover: true } } },
    });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Listing not found' });
    const [item] = await this.serialize([row]);
    assertNoPrivateFields(item);
    return item!;
  }

  async serialize(
    rows: (Prisma.PropertyGetPayload<{ select: typeof PUBLIC_SELECT }> & { media: { id: string; storageKey: string | null; width: number | null; height: number | null; isCover: boolean }[] })[],
  ): Promise<PublicListing[]> {
    const settings = await this.settings.current();
    const urls = await this.media.urls(rows.flatMap((r) => r.media));
    return Promise.all(
      rows.map(async (r) => {
        const names = await this.locations.names(r.areaId!, r.townId!, r.neighborhoodId);
        const photos: PublicPhoto[] = r.media
          .filter((m) => urls.has(m.id))
          .map((m) => ({ id: m.id, url: urls.get(m.id)!, width: m.width, height: m.height, isCover: m.isCover }));
        return toPublicListing(
          {
            ...r,
            publicRef: ref('DAR', r.refNo),
            listingType: r.listingType!,
            propertyType: r.propertyType!,
            titleAr: r.titleAr ?? '',
            descriptionAr: r.descriptionAr ?? '',
            areaId: r.areaId!,
            townId: r.townId!,
            priceCents: toCents(r.priceCents),
            availableFrom: dateOnly(r.availableFrom),
          },
          names,
          photos,
          { sale: settings.sale, rental: settings.rental },
        );
      }),
    );
  }

  // ------------------------------------------------------------ favorites

  async favorites(userId: string): Promise<PublicListing[]> {
    const favs = await this.prisma.favorite.findMany({
      where: { userId, property: this.publicWhere() },
      orderBy: { createdAt: 'desc' },
      select: {
        property: {
          select: { ...PUBLIC_SELECT, media: { where: { ...PUBLIC_PHOTO_WHERE, isCover: true }, take: 1, select: { id: true, storageKey: true, width: true, height: true, isCover: true } } },
        },
      },
    });
    const items = await this.serialize(favs.map((f) => f.property));
    assertNoPrivateFields(items);
    return items;
  }

  async favoriteIds(userId: string): Promise<string[]> {
    const favs = await this.prisma.favorite.findMany({ where: { userId }, select: { propertyId: true } });
    return favs.map((f) => f.propertyId);
  }

  async addFavorite(userId: string, propertyId: string) {
    const visible = await this.prisma.property.count({ where: { id: propertyId, ...this.publicWhere() } });
    if (!visible) throw new NotFoundException();
    await this.prisma.favorite.upsert({ where: { userId_propertyId: { userId, propertyId } }, create: { userId, propertyId }, update: {} });
  }

  async removeFavorite(userId: string, propertyId: string) {
    await this.prisma.favorite.deleteMany({ where: { userId, propertyId } });
  }
}
