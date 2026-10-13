import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Actor, Role } from '@dar/shared';
import { PrismaService } from './prisma.service';

/**
 * Every request is authenticated by a short-lived access token. The actor
 * (roles, blocked flag, collection permission) is re-read from the database
 * on each request, so role changes and blocks take effect immediately.
 */
export interface RequestActor extends Actor {
  fullName: string;
  sessionId: string;
}

export const IS_PUBLIC = 'isPublic';
export const OPTIONAL_AUTH = 'optionalAuth';
export const ROLES = 'roles';

/** No authentication needed (visitors). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Works for visitors, but identifies signed-in users. */
export const OptionalAuth = () => SetMetadata(OPTIONAL_AUTH, true);
/** Restricts to users holding at least one of these roles (coarse gate; record-level checks still apply). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const CurrentActor = createParamDecorator((_: unknown, ctx: ExecutionContext): RequestActor | null => {
  return ctx.switchToHttp().getRequest().actor ?? null;
});

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    const optional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH, [ctx.getHandler(), ctx.getClass()]);
    const header: string | undefined = req.headers['authorization'];
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    if (!token) {
      if (isPublic || optional) return true;
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Sign in required' });
    }

    let payload: { sub: string; sid: string };
    try {
      payload = await this.jwt.verifyAsync(token, { algorithms: ['HS256'] });
    } catch {
      if (isPublic) return true;
      throw new UnauthorizedException({ code: 'TOKEN_EXPIRED', message: 'Session expired' });
    }

    const [user, session] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, roles: true, blocked: true, canRecordCollections: true, fullName: true, anonymizedAt: true },
      }),
      this.prisma.session.findUnique({ where: { id: payload.sid }, select: { revokedAt: true, expiresAt: true, userId: true } }),
    ]);
    if (!user || user.anonymizedAt || !session || session.userId !== user.id || session.revokedAt || session.expiresAt < new Date()) {
      if (isPublic) return true;
      throw new UnauthorizedException({ code: 'SESSION_REVOKED', message: 'Session ended' });
    }
    if (user.blocked && !isPublic) throw new ForbiddenException({ code: 'ACCOUNT_BLOCKED', message: 'Account blocked' });

    req.actor = {
      id: user.id,
      roles: user.roles as Role[],
      blocked: user.blocked,
      canRecordCollections: user.canRecordCollections,
      fullName: user.fullName,
      sessionId: payload.sid,
    } satisfies RequestActor;

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (roles?.length && !roles.some((r) => user.roles.includes(r))) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not allowed' });
    }
    return true;
  }
}

/** Throws 403 unless the policy check passed. Use for every record-level decision. */
export function authorize(allowed: boolean, code = 'FORBIDDEN'): asserts allowed {
  if (!allowed) throw new ForbiddenException({ code, message: 'Not allowed' });
}

export function requireActor(actor: RequestActor | null): RequestActor {
  if (!actor) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Sign in required' });
  return actor;
}
