import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MediaKind } from '@prisma/client';
import {
  canAccessConversation,
  canEditPropertyAsOwner,
  isAdmin,
  isStaff,
  UPLOAD_LIMITS,
} from '@dar/shared';
import { createHash, randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { authorize, RequestActor } from '../../common/auth';
import { declaredMatches, sniffMime } from '../../common/file-sniff';
import { PrismaService } from '../../common/prisma.service';
import { StorageService } from '../storage/storage.service';

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'application/pdf': 'pdf',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

/**
 * Upload flow:
 *  1. intent  → server validates type/size/permission, returns a signed PUT URL
 *  2. client uploads directly to private storage (with progress, retryable)
 *  3. complete → server downloads, checks the real file type from its bytes,
 *     re-encodes images (which strips EXIF/GPS and all other metadata) and
 *     stores the processed copy; the raw upload is deleted.
 * New photos start as PENDING review and are never public until approved.
 */
@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async intent(
    actor: RequestActor,
    input: { kind: MediaKind; mimeType: string; sizeBytes: number; fileName: string; propertyId?: string; conversationId?: string },
  ) {
    const limits = UPLOAD_LIMITS[input.kind];
    if (!(limits.mime as readonly string[]).includes(input.mimeType)) {
      throw new BadRequestException({ code: 'UPLOAD_TYPE', message: 'File type not allowed' });
    }
    if (input.sizeBytes > limits.maxBytes) throw new BadRequestException({ code: 'UPLOAD_TOO_LARGE', message: 'File too large' });

    if (input.kind === 'MESSAGE_ATTACHMENT') {
      if (!input.conversationId) throw new BadRequestException({ code: 'CONVERSATION_REQUIRED', message: 'conversationId required' });
      const conv = await this.prisma.conversation.findUnique({ where: { id: input.conversationId } });
      if (!conv) throw new NotFoundException();
      authorize(canAccessConversation(actor, conv));
    } else {
      if (!input.propertyId) throw new BadRequestException({ code: 'PROPERTY_REQUIRED', message: 'propertyId required' });
      const p = await this.prisma.property.findUnique({ where: { id: input.propertyId }, select: { ownerId: true, status: true } });
      if (!p) throw new NotFoundException();
      authorize(canEditPropertyAsOwner(actor, p) || isAdmin(actor));
      if (['SOLD', 'ARCHIVED'].includes(p.status)) throw new BadRequestException({ code: 'LISTING_CLOSED', message: 'Listing is closed' });
      const count = await this.prisma.media.count({ where: { propertyId: input.propertyId, kind: input.kind, removedAt: null, status: { not: 'FAILED' } } });
      if (count >= limits.maxCount) throw new BadRequestException({ code: 'UPLOAD_LIMIT_REACHED', message: 'Too many files' });
    }

    const media = await this.prisma.media.create({
      data: {
        kind: input.kind,
        uploaderId: actor.id,
        propertyId: input.propertyId ?? null,
        incomingKey: `incoming/${cryptoId()}`,
        fileName: input.fileName.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 120),
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      },
    });
    const uploadUrl = await this.storage.driver.presignPut(media.incomingKey, input.mimeType, input.sizeBytes);
    return { mediaId: media.id, uploadUrl, method: 'PUT', headers: { 'Content-Type': input.mimeType } };
  }

  async complete(actor: RequestActor, mediaId: string) {
    const media = await this.prisma.media.findUnique({ where: { id: mediaId } });
    if (!media || media.uploaderId !== actor.id) throw new NotFoundException();
    if (media.status === 'READY') return this.summary(media.id); // idempotent
    if (media.status !== 'UPLOADING' && media.status !== 'FAILED') throw new BadRequestException({ code: 'UPLOAD_STATE', message: 'Upload already processing' });
    await this.prisma.media.update({ where: { id: media.id }, data: { status: 'PROCESSING' } });

    const limits = UPLOAD_LIMITS[media.kind];
    let raw: Buffer;
    try {
      raw = await this.storage.driver.get(media.incomingKey, limits.maxBytes + 1);
    } catch {
      await this.fail(media.id, 'UPLOAD_MISSING');
      throw new BadRequestException({ code: 'UPLOAD_MISSING', message: 'File was not uploaded' });
    }
    if (raw.length > limits.maxBytes) return this.reject(media.id, media.incomingKey, 'UPLOAD_TOO_LARGE');
    const sniffed = sniffMime(raw);
    // The declared type was allow-listed at intent time; the bytes must match it.
    if (!sniffed || !(limits.mime as readonly string[]).includes(media.mimeType) || !declaredMatches(media.mimeType, sniffed)) {
      return this.reject(media.id, media.incomingKey, 'UPLOAD_TYPE');
    }

    let out: Buffer = raw;
    let mime: string = sniffed;
    let width: number | null = null;
    let height: number | null = null;
    if (sniffed.startsWith('image/')) {
      try {
        // rotate() bakes in EXIF orientation; output carries NO metadata (EXIF, GPS, XMP, ICC comments).
        const img = sharp(raw, { failOn: 'error', limitInputPixels: 80_000_000 }).rotate();
        const resized = media.kind === 'PHOTO' ? img.resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true }) : img;
        const result = await resized.jpeg({ quality: 82, mozjpeg: true }).toBuffer({ resolveWithObject: true });
        out = result.data;
        width = result.info.width;
        height = result.info.height;
        mime = 'image/jpeg';
      } catch {
        return this.reject(media.id, media.incomingKey, 'IMAGE_UNREADABLE');
      }
    }
    // Note: videos are stored unmodified. Phone videos can embed location in
    // their container metadata; videos therefore always require manual review
    // before publication (see docs/SECURITY.md → Media metadata).

    const storageKey = `media/${media.id}.${EXT[mime] ?? 'bin'}`;
    await this.storage.driver.put(storageKey, out, mime);
    await this.storage.driver.delete(media.incomingKey).catch(() => undefined);
    const isFirstPhoto =
      media.kind === 'PHOTO' && media.propertyId
        ? (await this.prisma.media.count({ where: { propertyId: media.propertyId, kind: 'PHOTO', isCover: true, removedAt: null } })) === 0
        : false;
    const maxOrder = media.propertyId
      ? await this.prisma.media.aggregate({ where: { propertyId: media.propertyId, kind: media.kind }, _max: { sortOrder: true } })
      : null;
    await this.prisma.media.update({
      where: { id: media.id },
      data: {
        status: 'READY',
        storageKey,
        mimeType: mime,
        sizeBytes: out.length,
        width,
        height,
        sha256: createHash('sha256').update(out).digest('hex'),
        isCover: isFirstPhoto,
        sortOrder: (maxOrder?._max.sortOrder ?? -1) + 1,
        // Message attachments are shared only inside an authorized conversation.
        reviewStatus: media.kind === 'MESSAGE_ATTACHMENT' ? 'APPROVED' : 'PENDING',
      },
    });
    return this.summary(media.id);
  }

  private async reject(id: string, incomingKey: string, code: string): Promise<never> {
    await this.storage.driver.delete(incomingKey).catch(() => undefined);
    await this.fail(id, code);
    throw new BadRequestException({ code, message: 'File rejected' });
  }

  private fail(id: string, code: string) {
    return this.prisma.media.update({ where: { id }, data: { status: 'FAILED', failureCode: code } });
  }

  async summary(id: string) {
    const m = await this.prisma.media.findUniqueOrThrow({ where: { id } });
    return {
      id: m.id,
      kind: m.kind,
      status: m.status,
      reviewStatus: m.reviewStatus,
      isCover: m.isCover,
      sortOrder: m.sortOrder,
      width: m.width,
      height: m.height,
      fileName: m.fileName,
      url: m.storageKey ? await this.storage.driver.presignGet(m.storageKey) : null,
    };
  }

  async reorder(actor: RequestActor, propertyId: string, orderedIds: string[], coverId?: string) {
    const p = await this.prisma.property.findUnique({ where: { id: propertyId }, select: { ownerId: true } });
    if (!p) throw new NotFoundException();
    authorize(canEditPropertyAsOwner(actor, p) || isAdmin(actor));
    const photos = await this.prisma.media.findMany({ where: { propertyId, kind: 'PHOTO', removedAt: null, status: 'READY' }, select: { id: true } });
    const known = new Set(photos.map((x) => x.id));
    if (orderedIds.some((id) => !known.has(id)) || (coverId && !known.has(coverId))) {
      throw new BadRequestException({ code: 'MEDIA_UNKNOWN', message: 'Unknown photo' });
    }
    const cover = coverId ?? orderedIds[0];
    await this.prisma.$transaction([
      ...orderedIds.map((id, i) => this.prisma.media.update({ where: { id }, data: { sortOrder: i, isCover: id === cover } })),
      this.prisma.media.updateMany({ where: { propertyId, kind: 'PHOTO', id: { notIn: orderedIds } }, data: { isCover: false } }),
    ]);
    return { ok: true };
  }

  async remove(actor: RequestActor, mediaId: string) {
    const m = await this.prisma.media.findUnique({ where: { id: mediaId }, include: { property: { select: { ownerId: true } } } });
    if (!m || m.removedAt) throw new NotFoundException();
    authorize((m.property && canEditPropertyAsOwner(actor, m.property)) || isAdmin(actor) || m.uploaderId === actor.id);
    await this.prisma.media.update({ where: { id: m.id }, data: { removedAt: new Date(), isCover: false } });
    if (m.isCover && m.propertyId) {
      const next = await this.prisma.media.findFirst({
        where: { propertyId: m.propertyId, kind: 'PHOTO', removedAt: null, status: 'READY' },
        orderBy: { sortOrder: 'asc' },
      });
      if (next) await this.prisma.media.update({ where: { id: next.id }, data: { isCover: true } });
    }
    return { ok: true };
  }

  /** Private documents: admin or assigned employee only, short-lived download URL, audited by caller. */
  async documentUrl(actor: RequestActor, mediaId: string) {
    const m = await this.prisma.media.findUnique({ where: { id: mediaId }, include: { property: { select: { ownerId: true, assignedEmployeeId: true } } } });
    if (!m || !m.storageKey || m.removedAt) throw new NotFoundException();
    const allowed =
      isAdmin(actor) ||
      (isStaff(actor) && m.property?.assignedEmployeeId === actor.id) ||
      (m.property?.ownerId === actor.id && m.uploaderId === actor.id);
    authorize(allowed);
    return { url: await this.storage.driver.presignGet(m.storageKey, { downloadName: m.fileName, ttlSeconds: 120 }), propertyId: m.propertyId };
  }

  /** Signed URLs for a set of media rows. */
  async urls<T extends { id: string; storageKey: string | null }>(rows: T[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    await Promise.all(rows.map(async (r) => r.storageKey && out.set(r.id, await this.storage.driver.presignGet(r.storageKey))));
    return out;
  }
}

function cryptoId() {
  return randomBytes(16).toString('hex');
}
