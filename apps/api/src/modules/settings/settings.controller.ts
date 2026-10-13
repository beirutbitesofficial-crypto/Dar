import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { pricingSettingsSchema, reminderSettingsSchema } from '@dar/shared';
import { z } from 'zod';
import { CurrentActor, Public, RequestActor, Roles } from '../../common/auth';
import { zbody } from '../../common/zod.pipe';
import { SettingsService } from './settings.service';

const legalSchema = z.object({
  kind: z.enum(['TERMS', 'PRIVACY']),
  version: z.string().min(1).max(40),
  bodyAr: z.string().min(20),
  bodyEn: z.string().min(20),
  legalReviewPending: z.boolean(),
});

@Controller('v1')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Public()
  @Get('settings/public')
  publicSettings() {
    return this.settings.publicSettings();
  }

  @Public()
  @Get('legal/:kind')
  legal(@Param('kind') kind: string) {
    return this.settings.legal(kind === 'privacy' ? 'PRIVACY' : 'TERMS');
  }

  @Roles('ADMIN')
  @Get('admin/settings/pricing')
  async pricing() {
    return { current: await this.settings.current(), history: await this.settings.history() };
  }

  @Roles('ADMIN')
  @Post('admin/settings/pricing')
  async update(@CurrentActor() actor: RequestActor, @Body(zbody(pricingSettingsSchema)) body: z.infer<typeof pricingSettingsSchema>) {
    const version = await this.settings.update(actor.id, body);
    return { version, appliesTo: 'NEW_TRANSACTIONS_ONLY' };
  }

  @Roles('ADMIN')
  @Post('admin/legal')
  publishLegal(@CurrentActor() actor: RequestActor, @Body(zbody(legalSchema)) body: z.infer<typeof legalSchema>) {
    return this.settings.publishLegal(actor.id, body);
  }

  @Roles('ADMIN')
  @Get('admin/settings/reminders')
  reminders() {
    return this.settings.reminders();
  }

  @Roles('ADMIN')
  @Put('admin/settings/reminders')
  async setReminders(@CurrentActor() actor: RequestActor, @Body(zbody(reminderSettingsSchema)) body: z.infer<typeof reminderSettingsSchema>) {
    await this.settings.setReminders(actor.id, body);
    return { ok: true };
  }
}
