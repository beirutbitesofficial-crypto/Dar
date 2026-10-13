import { ConflictException, ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import type { AuthTokens, Me, RegisterInput, Role } from '@dar/shared';
import { AuditService } from '../../common/audit.service';
import { PrismaService } from '../../common/prisma.service';
import { env } from '../../config/env';
import { EmailService } from './email.service';

const MAX_FAILED_LOGINS = 8;
const LOCK_MINUTES = 15;
const RESET_TTL_MINUTES = 30;
// Dummy hash so failed lookups take as long as real verifications (no user enumeration by timing).
let DUMMY_HASH: Promise<string> | null = null;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
  ) {}

  private hashToken(token: string) {
    return createHmac('sha256', env().TOKEN_HASH_PEPPER).update(token).digest('hex');
  }

  private hashPassword(pw: string) {
    return argon2.hash(pw, { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 });
  }

  async register(input: RegisterInput, ip?: string): Promise<AuthTokens> {
    const exists = await this.prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (exists) throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'Email already registered' });
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: await this.hashPassword(input.password),
        fullName: input.fullName,
        phone: input.phone,
        // Never verified here: verification requires a configured OTP provider.
        phoneVerifiedAt: null,
        locale: input.locale,
        roles: ['CUSTOMER'],
        termsAcceptedVersion: input.acceptedTermsVersion,
        termsAcceptedAt: new Date(),
      },
    });
    return this.issue(user.id, 'mobile', undefined, ip);
  }

  async login(email: string, password: string, device: 'mobile' | 'admin', userAgent?: string, ip?: string): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const fail = () => new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password' });
    if (!user || user.anonymizedAt) {
      DUMMY_HASH ??= this.hashPassword('dummy-password-for-timing');
      await argon2.verify(await DUMMY_HASH, password).catch(() => false);
      throw fail();
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException({ code: 'RATE_LIMITED', message: 'Too many attempts. Try again later.' });
    }
    const ok = await argon2.verify(user.passwordHash, password).catch(() => false);
    if (!ok) {
      const failed = user.failedLoginCount + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failed >= MAX_FAILED_LOGINS ? 0 : failed,
          lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : undefined,
        },
      });
      await this.audit.log({ actorId: user.id, action: 'auth.login_failed', entityType: 'User', entityId: user.id, ip });
      throw fail();
    }
    if (user.blocked) throw new ForbiddenException({ code: 'ACCOUNT_BLOCKED', message: 'Account blocked' });
    if (device === 'admin' && !(user.roles as Role[]).some((r) => r === 'ADMIN' || r === 'EMPLOYEE')) {
      throw fail(); // the dashboard is for staff only
    }
    if (argon2.needsRehash?.(user.passwordHash, { memoryCost: 19_456, timeCost: 2 })) {
      await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await this.hashPassword(password) } });
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
    await this.audit.log({ actorId: user.id, action: 'auth.login', entityType: 'User', entityId: user.id, metadata: { device }, ip });
    return this.issue(user.id, device, userAgent, ip);
  }

  private async issue(userId: string, device: 'mobile' | 'admin', userAgent?: string, _ip?: string, familyId?: string): Promise<AuthTokens> {
    const refreshToken = randomBytes(32).toString('base64url');
    const ttlMs =
      device === 'admin' ? env().REFRESH_TOKEN_TTL_HOURS_ADMIN * 3_600_000 : env().REFRESH_TOKEN_TTL_DAYS_MOBILE * 86_400_000;
    const session = await this.prisma.session.create({
      data: {
        userId,
        device,
        userAgent: userAgent?.slice(0, 200),
        refreshTokenHash: this.hashToken(refreshToken),
        familyId: familyId ?? randomUUID(),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });
    const ttl = env().ACCESS_TOKEN_TTL_SECONDS;
    const accessToken = await this.jwt.signAsync({ sub: userId, sid: session.id }, { expiresIn: ttl, algorithm: 'HS256' });
    return { accessToken, refreshToken, accessTokenExpiresAt: new Date(Date.now() + ttl * 1000).toISOString() };
  }

  /**
   * Rotates the refresh token. Presenting an already-rotated token revokes the
   * whole session family (likely theft).
   */
  async refresh(refreshToken: string, userAgent?: string): Promise<AuthTokens> {
    const session = await this.prisma.session.findUnique({ where: { refreshTokenHash: this.hashToken(refreshToken) } });
    const invalid = () => new UnauthorizedException({ code: 'SESSION_REVOKED', message: 'Please sign in again' });
    if (!session) throw invalid();
    if (session.revokedAt) {
      if (session.revokedReason === 'rotated') {
        await this.prisma.session.updateMany({ where: { familyId: session.familyId, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: 'reuse_detected' } });
        await this.audit.log({ actorId: session.userId, action: 'auth.session_reuse_detected', entityType: 'Session', entityId: session.familyId });
      }
      throw invalid();
    }
    if (session.expiresAt < new Date()) throw invalid();
    const user = await this.prisma.user.findUnique({ where: { id: session.userId }, select: { blocked: true, anonymizedAt: true } });
    if (!user || user.blocked || user.anonymizedAt) throw invalid();
    const claimed = await this.prisma.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'rotated', lastUsedAt: new Date() },
    });
    if (claimed.count !== 1) throw invalid(); // concurrent refresh with the same token
    return this.issue(session.userId, session.device as 'mobile' | 'admin', userAgent, undefined, session.familyId);
  }

  async logout(sessionId: string) {
    await this.prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: 'logout' } });
  }

  async logoutAll(userId: string) {
    await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: 'logout_all' } });
  }

  /** Always responds the same way whether or not the email exists. */
  async forgotPassword(email: string) {
    if (!this.email.configured) {
      throw new ServiceUnavailableException({ code: 'EMAIL_NOT_CONFIGURED', message: 'Password reset email is not configured yet' });
    }
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true, locale: true, anonymizedAt: true } });
    if (!user || user.anonymizedAt) return;
    const token = randomBytes(32).toString('base64url');
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: this.hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000) },
    });
    const link = `${env().APP_DEEP_LINK_SCHEME}://reset-password?token=${token}`;
    const ar = user.locale !== 'en';
    await this.email.send(
      email,
      ar ? 'تغيير كلمة السر' : 'Reset your password',
      ar
        ? `لتغيير كلمة السر افتح الرابط التالي خلال ${RESET_TTL_MINUTES} دقيقة:\n${link}\nإذا ما طلبت هالشي، تجاهل الرسالة.`
        : `Open this link within ${RESET_TTL_MINUTES} minutes to reset your password:\n${link}\nIf you didn't request this, ignore this email.`,
    );
  }

  async resetPassword(token: string, newPassword: string) {
    const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: this.hashToken(token) } });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new UnauthorizedException({ code: 'RESET_TOKEN_INVALID', message: 'This link has expired' });
    }
    const passwordHash = await this.hashPassword(newPassword);
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: row.userId }, data: { passwordHash, failedLoginCount: 0, lockedUntil: null } }),
      this.prisma.session.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: 'password_reset' } }),
    ]);
    await this.audit.log({ actorId: row.userId, action: 'auth.password_reset', entityType: 'User', entityId: row.userId });
  }

  async changePassword(userId: string, current: string, next: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await argon2.verify(user.passwordHash, current).catch(() => false))) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect' });
    }
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await this.hashPassword(next) } });
  }

  async me(userId: string): Promise<Me> {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      phoneVerified: !!u.phoneVerifiedAt,
      roles: u.roles as Role[],
      locale: u.locale === 'en' ? 'en' : 'ar',
      canRecordCollections: u.canRecordCollections,
      deletionRequestedAt: u.deletionRequestedAt?.toISOString() ?? null,
    };
  }
}
