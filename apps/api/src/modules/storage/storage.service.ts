import { Injectable } from '@nestjs/common';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import { env } from '../../config/env';

/**
 * Private object storage. Nothing is publicly readable: clients receive
 * short-lived signed URLs, issued only after an authorization check.
 *
 * Key layout:
 *   incoming/<mediaId>      raw client upload (never served; deleted after processing)
 *   media/<mediaId>.<ext>   processed, metadata-stripped file
 */
export interface StorageDriver {
  presignPut(key: string, contentType: string, contentLength: number): Promise<string>;
  presignGet(key: string, opts?: { downloadName?: string; ttlSeconds?: number }): Promise<string>;
  get(key: string, maxBytes?: number): Promise<Buffer>;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
}

class S3Driver implements StorageDriver {
  private readonly client: S3Client;
  private readonly bucket = env().S3_BUCKET;
  constructor() {
    const e = env();
    this.client = new S3Client({
      region: e.S3_REGION,
      endpoint: e.S3_ENDPOINT || undefined,
      forcePathStyle: e.S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: e.S3_ACCESS_KEY_ID!, secretAccessKey: e.S3_SECRET_ACCESS_KEY! },
    });
  }
  presignPut(key: string, contentType: string, contentLength: number) {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType, ContentLength: contentLength }),
      { expiresIn: env().SIGNED_URL_TTL_SECONDS },
    );
  }
  presignGet(key: string, opts?: { downloadName?: string; ttlSeconds?: number }) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: opts?.downloadName ? `attachment; filename="${opts.downloadName.replace(/[^\w.-]/g, '_')}"` : undefined,
      }),
      { expiresIn: opts?.ttlSeconds ?? env().SIGNED_URL_TTL_SECONDS },
    );
  }
  async get(key: string, maxBytes = 250 * 1024 * 1024) {
    const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if ((out.ContentLength ?? 0) > maxBytes) throw new Error('OBJECT_TOO_LARGE');
    const bytes = await out.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }
  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }
  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

/**
 * DEVELOPMENT ONLY. Stores files on disk and signs URLs served by
 * DevStorageController. Refused at startup in production (see config/env.ts).
 */
export class LocalDriver implements StorageDriver {
  readonly root = join(process.cwd(), 'storage');
  private sign(payload: string) {
    return createHmac('sha256', env().TOKEN_HASH_PEPPER).update(payload).digest('base64url');
  }
  token(op: 'put' | 'get', key: string, ttl: number, extra = '') {
    const exp = Math.floor(Date.now() / 1000) + ttl;
    const payload = Buffer.from(JSON.stringify({ op, key, exp, extra })).toString('base64url');
    return `${payload}.${this.sign(payload)}`;
  }
  verify(token: string, op: 'put' | 'get'): { key: string; extra: string } | null {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const expected = Buffer.from(this.sign(payload));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (data.op !== op || data.exp < Date.now() / 1000) return null;
    return { key: data.key, extra: data.extra };
  }
  path(key: string) {
    const p = normalize(join(this.root, key));
    if (!p.startsWith(this.root)) throw new Error('INVALID_KEY');
    return p;
  }
  async presignPut(key: string, contentType: string, contentLength: number) {
    return `${env().PUBLIC_API_URL}/v1/dev-storage/${this.token('put', key, env().SIGNED_URL_TTL_SECONDS, `${contentType}|${contentLength}`)}`;
  }
  async presignGet(key: string, opts?: { downloadName?: string; ttlSeconds?: number }) {
    return `${env().PUBLIC_API_URL}/v1/dev-storage/${this.token('get', key, opts?.ttlSeconds ?? env().SIGNED_URL_TTL_SECONDS, opts?.downloadName ?? '')}`;
  }
  async get(key: string) {
    return readFile(this.path(key));
  }
  async put(key: string, body: Buffer) {
    const p = this.path(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, body);
  }
  async delete(key: string) {
    await rm(this.path(key), { force: true });
  }
}

@Injectable()
export class StorageService {
  readonly driver: StorageDriver = env().STORAGE_DRIVER === 'local' ? new LocalDriver() : new S3Driver();
}
