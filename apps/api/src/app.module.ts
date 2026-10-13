import { Controller, Get, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './common/audit.service';
import { AuthGuard, Public } from './common/auth';
import { ErrorsFilter } from './common/errors.filter';
import { PrismaModule, PrismaService } from './common/prisma.service';
import { env } from './config/env';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { EmailService } from './modules/auth/email.service';
import { ConversationsService } from './modules/crm/conversations.service';
import { CustomerCrmController, ReportsAdminController, StaffCrmController } from './modules/crm/crm.controller';
import { LeadsService } from './modules/crm/leads.service';
import { ViewingsService } from './modules/crm/viewings.service';
import { DashboardService } from './modules/dashboard/dashboard.service';
import { ReportsController } from './modules/dashboard/reports.controller';
import { FinancePartyController, FinanceStaffController } from './modules/finance/finance.controller';
import { RentalsService } from './modules/finance/rentals.service';
import { SalesService } from './modules/finance/sales.service';
import { JobsService } from './modules/jobs/jobs.service';
import { LocationsController } from './modules/locations/locations.controller';
import { NotificationsController } from './modules/notifications/notifications.controller';
import { NotificationsService } from './modules/notifications/notifications.service';
import { ListingsService } from './modules/properties/listings.service';
import { LocationCache } from './modules/properties/location-cache.service';
import { MediaService } from './modules/properties/media.service';
import { ModerationService } from './modules/properties/moderation.service';
import {
  EstimatesController,
  FavoritesController,
  ListingsController,
  ModerationController,
  OwnerPropertiesController,
  StaffPropertiesController,
  UploadsController,
} from './modules/properties/properties.controller';
import { PropertiesService } from './modules/properties/properties.service';
import { SettingsController } from './modules/settings/settings.controller';
import { SettingsService } from './modules/settings/settings.service';
import { DevStorageController } from './modules/storage/dev-storage.controller';
import { StorageService } from './modules/storage/storage.service';
import { UsersController } from './modules/users/users.controller';

@Controller()
class HealthController {
  constructor(private readonly prisma: PrismaService) {}
  @Public()
  @Get('health')
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      ok: true,
      integrations: {
        push: env().PUSH_ENABLED ? 'configured' : 'unconfigured',
        email: env().EMAIL_DRIVER === 'smtp' ? 'configured' : env().EMAIL_DRIVER === 'console' ? 'development_console' : 'unconfigured',
        phoneOtp: 'unconfigured',
        ocr: 'unconfigured',
        payments: 'manual_recording_only',
        storage: env().STORAGE_DRIVER,
      },
    };
  }
}

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    JwtModule.register({ secret: env().JWT_ACCESS_SECRET, signOptions: { algorithm: 'HS256' } }),
  ],
  controllers: [
    HealthController,
    AuthController,
    UsersController,
    SettingsController,
    LocationsController,
    ListingsController,
    FavoritesController,
    EstimatesController,
    OwnerPropertiesController,
    UploadsController,
    StaffPropertiesController,
    ModerationController,
    CustomerCrmController,
    StaffCrmController,
    ReportsAdminController,
    FinanceStaffController,
    FinancePartyController,
    ReportsController,
    NotificationsController,
    DevStorageController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: ErrorsFilter },
    AuthService,
    EmailService,
    SettingsService,
    StorageService,
    NotificationsService,
    LocationCache,
    MediaService,
    PropertiesService,
    ListingsService,
    ModerationService,
    ViewingsService,
    LeadsService,
    ConversationsService,
    SalesService,
    RentalsService,
    DashboardService,
    JobsService,
  ],
})
export class AppModule {}
