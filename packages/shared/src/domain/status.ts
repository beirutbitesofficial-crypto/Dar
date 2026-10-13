import { AgreementStatus, LeadStatus, ListingStatus, Role, ViewingStatus } from './enums';
import { DomainError } from './errors';

/**
 * Explicit state machines. Listing, lead, viewing and agreement statuses are
 * separate and evolve independently.
 */
type Who = 'OWNER' | 'STAFF' | 'ADMIN' | 'CUSTOMER' | 'SYSTEM';

interface Rule<S extends string> {
  from: S;
  to: S;
  by: readonly Who[];
  requires?: 'reason';
}

function machine<S extends string>(name: string, rules: readonly Rule<S>[]) {
  return {
    name,
    rules,
    allowed(from: S, to: S, who: Who): Rule<S> | undefined {
      return rules.find((r) => r.from === from && r.to === to && r.by.includes(who));
    },
    next(from: S, who: Who): S[] {
      return rules.filter((r) => r.from === from && r.by.includes(who)).map((r) => r.to);
    },
    assert(from: S, to: S, who: Who, ctx?: { reason?: string | null }): void {
      const rule = this.allowed(from, to, who);
      if (!rule) throw new DomainError('INVALID_TRANSITION', `${name}: ${from} → ${to} is not allowed for ${who}`);
      if (rule.requires === 'reason' && !(ctx?.reason && ctx.reason.trim().length >= 3)) {
        throw new DomainError('TRANSITION_REASON_REQUIRED', `${name}: a reason is required for ${from} → ${to}`);
      }
    },
  };
}

const L = ListingStatus;
export const listingMachine = machine<ListingStatus>('listing', [
  { from: L.DRAFT, to: L.PENDING_REVIEW, by: ['OWNER', 'ADMIN'] },
  { from: L.DRAFT, to: L.ARCHIVED, by: ['OWNER', 'ADMIN'] },
  { from: L.PENDING_REVIEW, to: L.PUBLISHED, by: ['ADMIN'] },
  { from: L.PENDING_REVIEW, to: L.REJECTED, by: ['ADMIN'], requires: 'reason' },
  { from: L.PENDING_REVIEW, to: L.DRAFT, by: ['OWNER'] },
  { from: L.REJECTED, to: L.PENDING_REVIEW, by: ['OWNER', 'ADMIN'] },
  { from: L.REJECTED, to: L.DRAFT, by: ['OWNER'] },
  { from: L.REJECTED, to: L.ARCHIVED, by: ['OWNER', 'ADMIN'] },
  { from: L.PUBLISHED, to: L.PAUSED, by: ['OWNER', 'ADMIN', 'STAFF'] },
  { from: L.PUBLISHED, to: L.RENTED, by: ['ADMIN', 'SYSTEM'] },
  { from: L.PUBLISHED, to: L.SOLD, by: ['ADMIN', 'SYSTEM'] },
  { from: L.PUBLISHED, to: L.ARCHIVED, by: ['ADMIN'], requires: 'reason' },
  { from: L.PAUSED, to: L.PUBLISHED, by: ['OWNER', 'ADMIN'] },
  { from: L.PAUSED, to: L.PENDING_REVIEW, by: ['OWNER', 'ADMIN'] },
  { from: L.PAUSED, to: L.ARCHIVED, by: ['OWNER', 'ADMIN'] },
  { from: L.PAUSED, to: L.RENTED, by: ['ADMIN', 'SYSTEM'] }, // deal closed while paused for negotiations
  { from: L.PAUSED, to: L.SOLD, by: ['ADMIN', 'SYSTEM'] },
  { from: L.RENTED, to: L.PENDING_REVIEW, by: ['OWNER', 'ADMIN'] }, // relist after a lease ends
  { from: L.RENTED, to: L.ARCHIVED, by: ['ADMIN'] },
  { from: L.SOLD, to: L.ARCHIVED, by: ['ADMIN'] },
  { from: L.ARCHIVED, to: L.DRAFT, by: ['ADMIN'] },
]);

/** The ONLY statuses visible to the public. */
export const PUBLIC_LISTING_STATUSES: readonly ListingStatus[] = [L.PUBLISHED];

export function isPubliclyVisible(listing: { status: ListingStatus; approvedAt?: Date | string | null }): boolean {
  return PUBLIC_LISTING_STATUSES.includes(listing.status) && !!listing.approvedAt;
}

const LS = LeadStatus;
const OPEN_LEAD: LeadStatus[] = [LS.NEW, LS.ASSIGNED, LS.CONTACTED, LS.VIEWING_SCHEDULED, LS.VIEWED, LS.NEGOTIATION];
export const leadMachine = machine<LeadStatus>('lead', [
  { from: LS.NEW, to: LS.ASSIGNED, by: ['ADMIN', 'SYSTEM'] },
  { from: LS.ASSIGNED, to: LS.ASSIGNED, by: ['ADMIN'] }, // reassignment
  { from: LS.ASSIGNED, to: LS.CONTACTED, by: ['STAFF', 'ADMIN'] },
  { from: LS.ASSIGNED, to: LS.VIEWING_SCHEDULED, by: ['STAFF', 'ADMIN'] },
  { from: LS.CONTACTED, to: LS.VIEWING_SCHEDULED, by: ['STAFF', 'ADMIN'] },
  { from: LS.CONTACTED, to: LS.NEGOTIATION, by: ['STAFF', 'ADMIN'] },
  { from: LS.VIEWING_SCHEDULED, to: LS.VIEWED, by: ['STAFF', 'ADMIN'] },
  { from: LS.VIEWING_SCHEDULED, to: LS.CONTACTED, by: ['STAFF', 'ADMIN'] }, // viewing cancelled
  { from: LS.VIEWED, to: LS.VIEWING_SCHEDULED, by: ['STAFF', 'ADMIN'] }, // second viewing
  { from: LS.VIEWED, to: LS.NEGOTIATION, by: ['STAFF', 'ADMIN'] },
  { from: LS.NEGOTIATION, to: LS.VIEWING_SCHEDULED, by: ['STAFF', 'ADMIN'] },
  { from: LS.NEGOTIATION, to: LS.WON, by: ['ADMIN', 'SYSTEM'] }, // via an approved closing / agreement
  ...OPEN_LEAD.map((from) => ({ from, to: LS.LOST, by: ['STAFF', 'ADMIN'] as Who[], requires: 'reason' as const })),
  { from: LS.LOST, to: LS.ASSIGNED, by: ['ADMIN'] }, // reopen
]);

const V = ViewingStatus;
export const viewingMachine = machine<ViewingStatus>('viewing', [
  { from: V.REQUESTED, to: V.CONFIRMED, by: ['STAFF', 'ADMIN'] },
  { from: V.REQUESTED, to: V.CANCELLED, by: ['CUSTOMER', 'STAFF', 'ADMIN'] },
  { from: V.REQUESTED, to: V.REQUESTED, by: ['CUSTOMER'] }, // customer changes preferred times
  { from: V.CONFIRMED, to: V.REQUESTED, by: ['CUSTOMER', 'STAFF', 'ADMIN'] }, // reschedule
  { from: V.CONFIRMED, to: V.CONFIRMED, by: ['STAFF', 'ADMIN'] }, // move confirmed time
  { from: V.CONFIRMED, to: V.COMPLETED, by: ['STAFF', 'ADMIN'] },
  { from: V.CONFIRMED, to: V.NO_SHOW, by: ['STAFF', 'ADMIN'] },
  { from: V.CONFIRMED, to: V.CANCELLED, by: ['CUSTOMER', 'STAFF', 'ADMIN'] },
]);

const A = AgreementStatus;
export const agreementMachine = machine<AgreementStatus>('agreement', [
  { from: A.DRAFT, to: A.ACTIVE, by: ['ADMIN'] },
  { from: A.DRAFT, to: A.CANCELLED, by: ['ADMIN'], requires: 'reason' },
  { from: A.ACTIVE, to: A.ENDED, by: ['ADMIN', 'SYSTEM'] },
  { from: A.ACTIVE, to: A.TERMINATED, by: ['ADMIN'], requires: 'reason' },
]);

/** Maps a user's roles to the actor class used by the state machines. */
export function actorClass(roles: readonly Role[], relation: { isOwner?: boolean; isCustomer?: boolean }): Who {
  if (roles.includes(Role.ADMIN)) return 'ADMIN';
  if (roles.includes(Role.EMPLOYEE)) return 'STAFF';
  if (relation.isOwner) return 'OWNER';
  return 'CUSTOMER';
}

export type { Who as TransitionActor };
