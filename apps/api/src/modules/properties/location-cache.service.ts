import { Injectable } from '@nestjs/common';
import type { LocationNames } from '@dar/shared';
import { PrismaService } from '../../common/prisma.service';

type Loc = { id: string; nameAr: string; nameEn: string; lat: number | null; lng: number | null; kind: string; parentId: string | null };

/** Small in-memory cache of the location directory (refreshed every minute). */
@Injectable()
export class LocationCache {
  private map = new Map<string, Loc>();
  private loadedAt = 0;
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<Map<string, Loc>> {
    if (Date.now() - this.loadedAt > 60_000) {
      const rows = await this.prisma.location.findMany();
      this.map = new Map(
        rows.map((r) => [r.id, { id: r.id, nameAr: r.nameAr, nameEn: r.nameEn, lat: r.lat ? Number(r.lat) : null, lng: r.lng ? Number(r.lng) : null, kind: r.kind, parentId: r.parentId }]),
      );
      this.loadedAt = Date.now();
    }
    return this.map;
  }

  invalidate() {
    this.loadedAt = 0;
  }

  async names(areaId: string, townId: string, neighborhoodId: string | null): Promise<LocationNames> {
    const m = await this.get();
    const area = m.get(areaId);
    const town = m.get(townId);
    const hood = neighborhoodId ? m.get(neighborhoodId) : null;
    return {
      area: { id: areaId, nameAr: area?.nameAr ?? '', nameEn: area?.nameEn ?? '' },
      town: { id: townId, nameAr: town?.nameAr ?? '', nameEn: town?.nameEn ?? '', lat: town?.lat ?? null, lng: town?.lng ?? null },
      neighborhood: hood ? { id: hood.id, nameAr: hood.nameAr, nameEn: hood.nameEn } : null,
    };
  }

  /** Validates that town belongs to area and neighborhood to town. */
  async validateHierarchy(areaId?: string | null, townId?: string | null, neighborhoodId?: string | null): Promise<boolean> {
    const m = await this.get();
    if (townId) {
      const t = m.get(townId);
      if (!t || t.kind !== 'TOWN' || (areaId && t.parentId !== areaId)) return false;
    }
    if (areaId && m.get(areaId)?.kind !== 'AREA') return false;
    if (neighborhoodId) {
      const n = m.get(neighborhoodId);
      if (!n || n.kind !== 'NEIGHBORHOOD' || (townId && n.parentId !== townId)) return false;
    }
    return true;
  }
}
