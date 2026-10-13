import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Actor,
  canAccessConversation,
  canApproveFeeOverride,
  canChangePricingSettings,
  canModerateListings,
  canReadInternalNotes,
  canRecordCollection,
  canRecordPayout,
  canViewAgreementAsParty,
  canViewAgreementAsStaff,
  canViewLead,
  canViewOwnerContact,
  canViewPropertyPrivateDetails,
} from '../src/domain';

const admin: Actor = { id: 'admin', roles: ['ADMIN'] };
const blockedAdmin: Actor = { id: 'admin2', roles: ['ADMIN'], blocked: true };
const emp1: Actor = { id: 'emp1', roles: ['EMPLOYEE'] };
const emp1Collector: Actor = { id: 'emp1', roles: ['EMPLOYEE'], canRecordCollections: true };
const emp2: Actor = { id: 'emp2', roles: ['EMPLOYEE'], canRecordCollections: true };
const owner: Actor = { id: 'owner', roles: ['CUSTOMER', 'OWNER'] };
const customer: Actor = { id: 'cust', roles: ['CUSTOMER'] };
const otherCustomer: Actor = { id: 'cust2', roles: ['CUSTOMER', 'OWNER'] };

const property = { ownerId: 'owner', assignedEmployeeId: 'emp1' };
const lead = { customerId: 'cust', assignedEmployeeId: 'emp1', propertyId: 'p1' };
const conversation = { customerId: 'cust', assignedEmployeeId: 'emp1' };
const agreement = { landlordId: 'owner', tenantId: 'cust', assignedEmployeeId: 'emp1' };

test('owner contact + exact location: admin, assigned employee and the owner only', () => {
  assert.equal(canViewOwnerContact(admin, property), true);
  assert.equal(canViewOwnerContact(emp1, property), true);
  assert.equal(canViewOwnerContact(owner, property), true);
  assert.equal(canViewOwnerContact(emp2, property), false, 'unassigned employee');
  assert.equal(canViewOwnerContact(customer, property), false, 'customer');
  assert.equal(canViewOwnerContact(otherCustomer, property), false, 'another owner');
  assert.equal(canViewOwnerContact(null, property), false, 'visitor');
  assert.equal(canViewOwnerContact(blockedAdmin, property), false, 'blocked account');
  assert.equal(canViewPropertyPrivateDetails(emp2, property), false);
  assert.equal(canViewPropertyPrivateDetails(emp1, { ownerId: 'owner', assignedEmployeeId: null }), false);
});

test('leads: admin and the assigned employee only — never the customer or owner', () => {
  assert.equal(canViewLead(admin, lead), true);
  assert.equal(canViewLead(emp1, lead), true);
  assert.equal(canViewLead(emp2, lead), false);
  assert.equal(canViewLead(customer, lead), false);
  assert.equal(canViewLead(owner, lead), false);
});

test('conversations: the customer, assigned employee or admin; never the owner', () => {
  assert.equal(canAccessConversation(customer, conversation), true);
  assert.equal(canAccessConversation(emp1, conversation), true);
  assert.equal(canAccessConversation(admin, conversation), true);
  assert.equal(canAccessConversation(owner, conversation), false);
  assert.equal(canAccessConversation(emp2, conversation), false);
  assert.equal(canAccessConversation(otherCustomer, conversation), false);
  assert.equal(canAccessConversation(null, conversation), false);
});

test('internal notes are staff-only (customers never see them)', () => {
  assert.equal(canReadInternalNotes(customer, conversation), false);
  assert.equal(canReadInternalNotes(owner, conversation), false);
  assert.equal(canReadInternalNotes(emp1, conversation), true);
  assert.equal(canReadInternalNotes(emp2, conversation), false);
});

test('money: collections need explicit employee permission + assignment; payouts and settings are admin-only', () => {
  assert.equal(canRecordCollection(emp1, agreement), false, 'assigned but no permission');
  assert.equal(canRecordCollection(emp1Collector, agreement), true);
  assert.equal(canRecordCollection(emp2, agreement), false, 'permission but not assigned');
  assert.equal(canRecordCollection(owner, agreement), false);
  assert.equal(canRecordCollection(admin, agreement), true);
  for (const a of [emp1Collector, owner, customer]) {
    assert.equal(canRecordPayout(a), false);
    assert.equal(canChangePricingSettings(a), false);
    assert.equal(canApproveFeeOverride(a), false);
    assert.equal(canModerateListings(a), false);
  }
  assert.equal(canRecordPayout(admin), true);
});

test('agreements: parties see their own side; staff by assignment', () => {
  assert.equal(canViewAgreementAsParty(owner, agreement), 'LANDLORD');
  assert.equal(canViewAgreementAsParty(customer, agreement), 'TENANT');
  assert.equal(canViewAgreementAsParty(otherCustomer, agreement), null);
  assert.equal(canViewAgreementAsStaff(emp1, agreement), true);
  assert.equal(canViewAgreementAsStaff(emp2, agreement), false);
});
