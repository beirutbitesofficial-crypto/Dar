import { Controller, ForbiddenException, Get, Param, Put, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../common/auth';
import { env } from '../../config/env';
import { LocalDriver } from './storage.service';
import { StorageService } from './storage.service';

/** Serves signed URLs for the development-only local storage driver. */
@Controller('v1/dev-storage')
export class DevStorageController {
  constructor(private readonly storage: StorageService) {}

  private local(): LocalDriver {
    if (env().NODE_ENV === 'production' || !(this.storage.driver instanceof LocalDriver)) throw new ForbiddenException();
    return this.storage.driver;
  }

  @Public()
  @Put(':token')
  async upload(@Param('token') token: string, @Req() req: Request) {
    const driver = this.local();
    const v = driver.verify(token, 'put');
    if (!v) throw new ForbiddenException({ code: 'SIGNATURE_INVALID', message: 'Invalid or expired upload URL' });
    const [, maxLen] = v.extra.split('|');
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of req as AsyncIterable<Buffer>) {
      total += chunk.length;
      if (total > Number(maxLen)) throw new ForbiddenException({ code: 'UPLOAD_TOO_LARGE', message: 'Too large' });
      chunks.push(chunk);
    }
    await driver.put(v.key, Buffer.concat(chunks));
    return { ok: true };
  }

  @Public()
  @Get(':token')
  async download(@Param('token') token: string, @Res() res: Response) {
    const driver = this.local();
    const v = driver.verify(token, 'get');
    if (!v) throw new ForbiddenException({ code: 'SIGNATURE_INVALID', message: 'Invalid or expired URL' });
    const body = await driver.get(v.key);
    if (v.extra) res.setHeader('Content-Disposition', `attachment; filename="${v.extra.replace(/[^\w.-]/g, '_')}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(body);
  }
}
