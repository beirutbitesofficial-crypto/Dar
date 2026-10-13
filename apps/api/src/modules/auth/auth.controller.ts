import { Body, Controller, Get, HttpCode, Post, Req, ServiceUnavailableException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
} from '@dar/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { CurrentActor, Public, RequestActor } from '../../common/auth';
import { zbody } from '../../common/zod.pipe';
import { env } from '../../config/env';
import { AuthService } from './auth.service';

/** Stricter per-IP limits on authentication endpoints. */
const AUTH_LIMIT = { default: { limit: 10, ttl: 60_000 } };

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('register')
  register(@Body(zbody(registerSchema)) body: z.infer<typeof registerSchema>, @Req() req: Request) {
    return this.auth.register(body, req.ip);
  }

  @Public()
  @Throttle(AUTH_LIMIT)
  @HttpCode(200)
  @Post('login')
  login(@Body(zbody(loginSchema)) body: z.infer<typeof loginSchema>, @Req() req: Request) {
    return this.auth.login(body.email, body.password, body.device, req.headers['user-agent'], req.ip);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body(zbody(refreshSchema)) body: z.infer<typeof refreshSchema>, @Req() req: Request) {
    return this.auth.refresh(body.refreshToken, req.headers['user-agent']);
  }

  @HttpCode(204)
  @Post('logout')
  async logout(@CurrentActor() actor: RequestActor) {
    await this.auth.logout(actor.sessionId);
  }

  @HttpCode(204)
  @Post('logout-all')
  async logoutAll(@CurrentActor() actor: RequestActor) {
    await this.auth.logoutAll(actor.id);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @HttpCode(202)
  @Post('forgot-password')
  async forgot(@Body(zbody(forgotPasswordSchema)) body: z.infer<typeof forgotPasswordSchema>) {
    await this.auth.forgotPassword(body.email);
    return { ok: true };
  }

  @Public()
  @Throttle(AUTH_LIMIT)
  @HttpCode(204)
  @Post('reset-password')
  async reset(@Body(zbody(resetPasswordSchema)) body: z.infer<typeof resetPasswordSchema>) {
    await this.auth.resetPassword(body.token, body.password);
  }

  @Throttle(AUTH_LIMIT)
  @HttpCode(204)
  @Post('change-password')
  async change(@CurrentActor() actor: RequestActor, @Body(zbody(changePasswordSchema)) body: z.infer<typeof changePasswordSchema>) {
    await this.auth.changePassword(actor.id, body.currentPassword, body.newPassword);
  }

  @Get('me')
  me(@CurrentActor() actor: RequestActor) {
    return this.auth.me(actor.id);
  }

  /**
   * Phone OTP is an optional integration. With no provider configured this
   * returns 501 and the phone stays unverified — it is never marked verified.
   */
  @Throttle({ default: { limit: 3, ttl: 10 * 60_000 } })
  @Post('phone/send-code')
  sendPhoneCode() {
    if (env().OTP_PROVIDER === 'none') {
      throw new ServiceUnavailableException({ code: 'OTP_NOT_CONFIGURED', message: 'Phone verification is not available yet' });
    }
  }
}
