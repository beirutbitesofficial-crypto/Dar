import { Role } from './enums';

/**
 * Server-side authorization rules. The API calls these for EVERY protected
 * operation; client-side hiding is cosmetic only. Each function answers one
 * question about one record so it can be unit-tested exhaustively.
 */
export interface Actor {
  id: string;
  roles: readonly Role[];
  /** Employees may be granted permission to record tenant collections. */
  canRecordCollections?: boolean;
  blocked?: boolean;
}

export interface PropertyRef {
  ownerId: string;
  assignedEmployeeId?: string | null;
}

export interface LeadRef {
  customerId: string;
  assignedEmployeeId?: string | null;
  propertyId: string;
}

export interface ConversationRef {
  customerId: string;
  assignedEmployeeId?: string | null;
}

export interface AgreementRef {
  landlordId: string;
  tenantId: string;
  assignedEmployeeId?: string | null;
}

export const isAdmin = (a: Actor | null | undefined) => !!a && !a.blocked && a.roles.includes(Role.ADMIN);
export const isEmployee = (a: Actor | null | undefined) => !!a && !a.blocked && a.roles.includes(Role.EMPLOYEE);
export const isStaff = (a: Actor | null | undefined) => isAdmin(a) || isEmployee(a);
const active = (a: Actor | null | undefined): a is Actor => !!a && !a.blocked;

// --- Properties -------------------------------------------------------------

export function isAssignedEmployee(a: Actor | null | undefined, ref: { assignedEmployeeId?: string | null }) {
  return isEmployee(a) && !!ref.assignedEmployeeId && ref.assignedEmployeeId === a!.id;
}

/** Owner contact details, exact address, precise pin, private documents. */
export function canViewPropertyPrivateDetails(a: Actor | null | undefined, p: PropertyRef): boolean {
  if (!active(a)) return false;
  if (isAdmin(a)) return true;
  if (isAssignedEmployee(a, p)) return true;
  return a.id === p.ownerId; // owners see the private data they themselves entered
}

/** The owner's personal contact is never shown to customers. */
export function canViewOwnerContact(a: Actor | null | undefined, p: PropertyRef): boolean {
  if (!active(a)) return false;
  return isAdmin(a) || isAssignedEmployee(a, p) || a.id === p.ownerId;
}

export function canEditPropertyAsOwner(a: Actor | null | undefined, p: PropertyRef): boolean {
  return active(a) && a.id === p.ownerId;
}

export function canModerateListings(a: Actor | null | undefined): boolean {
  return isAdmin(a);
}

export function canViewStaffPropertyRecord(a: Actor | null | undefined, p: PropertyRef): boolean {
  return isAdmin(a) || isAssignedEmployee(a, p);
}

// --- Leads, viewings, conversations ----------------------------------------

export function canViewLead(a: Actor | null | undefined, lead: LeadRef): boolean {
  return isAdmin(a) || isAssignedEmployee(a, lead);
}

export function canWorkLead(a: Actor | null | undefined, lead: LeadRef): boolean {
  return canViewLead(a, lead);
}

export function canAssignLeads(a: Actor | null | undefined): boolean {
  return isAdmin(a);
}

/** Customers see their own viewing requests (never the internal lead record). */
export function canViewViewingAsCustomer(a: Actor | null | undefined, v: { customerId: string }): boolean {
  return active(a) && a.id === v.customerId;
}

export function canAccessConversation(a: Actor | null | undefined, c: ConversationRef): boolean {
  if (!active(a)) return false;
  return isAdmin(a) || isAssignedEmployee(a, c) || a.id === c.customerId;
}

export function canReadInternalNotes(a: Actor | null | undefined, ref: { assignedEmployeeId?: string | null }): boolean {
  return isAdmin(a) || isAssignedEmployee(a, ref);
}

// --- Money ------------------------------------------------------------------

export function canViewAgreementAsStaff(a: Actor | null | undefined, ag: AgreementRef): boolean {
  return isAdmin(a) || isAssignedEmployee(a, ag);
}

export function canViewAgreementAsParty(a: Actor | null | undefined, ag: AgreementRef): 'LANDLORD' | 'TENANT' | null {
  if (!active(a)) return null;
  if (a.id === ag.landlordId) return 'LANDLORD';
  if (a.id === ag.tenantId) return 'TENANT';
  return null;
}

export function canRecordCollection(a: Actor | null | undefined, ag: AgreementRef): boolean {
  if (isAdmin(a)) return true;
  return isAssignedEmployee(a, ag) && !!a!.canRecordCollections;
}

/** Reversals, refunds, waivers, payouts and settings are admin-only. */
export function canRecordFinancialCorrection(a: Actor | null | undefined): boolean {
  return isAdmin(a);
}
export function canRecordPayout(a: Actor | null | undefined): boolean {
  return isAdmin(a);
}
export function canChangePricingSettings(a: Actor | null | undefined): boolean {
  return isAdmin(a);
}
export function canApproveFeeOverride(a: Actor | null | undefined): boolean {
  return isAdmin(a);
}
export function canRequestFeeOverride(a: Actor | null | undefined, ref: { assignedEmployeeId?: string | null }): boolean {
  return isAdmin(a) || isAssignedEmployee(a, ref);
}
export function canManageUsers(a: Actor | null | undefined): boolean {
  return isAdmin(a);
}
export function canViewAuditLog(a: Actor | null | undefined): boolean {
  return isAdmin(a);
}
