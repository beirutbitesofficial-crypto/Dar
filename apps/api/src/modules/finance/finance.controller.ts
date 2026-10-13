import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  agreementAcceptanceSchema,
  AgreementStatus,
  amendmentSchema,
  recordPaymentSchema,
  recordPayoutSchema,
  refundSchema,
  rentalAgreementSchema,
  reversalSchema,
  saleClosingSchema,
  salePaymentSchema,
  terminationSchema,
  waiveSchema,
} from '@dar/shared';
import { z } from 'zod';
import { CurrentActor, RequestActor, Roles } from '../../common/auth';
import { zbody } from '../../common/zod.pipe';
import { RentalsService } from './rentals.service';
import { SalesService } from './sales.service';

const reasonSchema = z.object({ reason: z.string().min(5).max(500) });
const renewSchema = z.object({ endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), enteredAmountCents: z.number().int().positive().optional(), keepCurrentFee: z.boolean().default(false) });
const depositSchema = z.object({
  kind: z.enum(['RECEIVED', 'RETURNED', 'APPLIED_TO_DAMAGES']),
  amountCents: z.number().int().positive(),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'OTHER']),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference: z.string().max(120).optional(),
  notes: z.string().max(500).optional(),
  idempotencyKey: z.string().uuid(),
});
const payoutReversalSchema = z.object({ reason: z.string().min(5).max(500), idempotencyKey: z.string().uuid() });
const partyAcceptSchema = z.object({ termsVersion: z.string().min(1), disclosedMonthlyCents: z.number().int().min(0) });

// ---------------------------------------------------------------------------
// Staff / admin
// ---------------------------------------------------------------------------
@Controller('v1/staff')
@Roles('ADMIN', 'EMPLOYEE')
export class FinanceStaffController {
  constructor(
    private readonly sales: SalesService,
    private readonly rentals: RentalsService,
  ) {}

  // Sales
  @Get('sales')
  salesList(@CurrentActor() a: RequestActor, @Query('status') status?: string) {
    return this.sales.list(a, status);
  }
  @Post('sales')
  requestClosing(@CurrentActor() a: RequestActor, @Body(zbody(saleClosingSchema)) b: z.infer<typeof saleClosingSchema>) {
    return this.sales.request(a, b);
  }
  @Get('sales/:id')
  sale(@CurrentActor() a: RequestActor, @Param('id') id: string) {
    return this.sales.detail(a, id);
  }
  @Roles('ADMIN')
  @Post('sales/:id/approve')
  approveSale(@CurrentActor() a: RequestActor, @Param('id') id: string) {
    return this.sales.approve(a, id);
  }
  @Roles('ADMIN')
  @Post('sales/:id/cancel')
  cancelSale(@CurrentActor() a: RequestActor, @Param('id') id: string, @Body(zbody(reasonSchema)) b: z.infer<typeof reasonSchema>) {
    return this.sales.cancel(a, id, b.reason);
  }
  @Post('sales/:id/entries')
  saleEntry(@CurrentActor() a: RequestActor, @Param('id') id: string, @Body(zbody(salePaymentSchema)) b: z.infer<typeof salePaymentSchema>) {
    return this.sales.recordEntry(a, id, b);
  }
  @Roles('ADMIN')
  @Post('sales/entries/reverse')
  saleReverse(@CurrentActor() a: RequestActor, @Body(zbody(reversalSchema)) b: z.infer<typeof reversalSchema>) {
    return this.sales.reverse(a, b.entryId, b.reason, b.idempotencyKey);
  }
  @Roles('ADMIN')
  @Post('sales/obligations/:id/waive')
  saleWaive(@CurrentActor() a: RequestActor, @Param('id') id: string, @Body(zbody(waiveSchema)) b: z.infer<typeof waiveSchema>) {
    return this.sales.waive(a, id, b.reason);
  }

  // Rental agreements
  @Get('agreements')
  agreements(@CurrentActor() a: RequestActor, @Query('status') status?: AgreementStatus) {
    return this.rentals.list(a, status);
  }
  @Post('agreements')
  createAgreement(@CurrentActor() a: RequestActor, @Body(zbody(rentalAgreementSchema)) b: z.infer<typeof rentalAgreementSchema>) {
    return this.rentals.create(a, b);
  }
  @Get('agreements/:id')
  agreement(@CurrentActor() a: RequestActor, @Param('id') id: string) {
    return this.rentals.staffDetail(a, id);
  }
  @Post('agreements/:id/acceptance')
  acceptance(@CurrentActor() a: RequestActor, @Param('id') id: string, @Body(zbody(agreementAcceptanceSchema)) b: z.infer<typeof agreementAcceptanceSchema>) {
    return this.rentals.recordAcceptance(a, id, b.party, b.acceptedAt, b.channel);
  }
  @Roles('ADMIN')
  @Post('agreements/:id/activate')
  activate(@CurrentActor() a: RequestActor, @Param('id') id: string) {
    return this.rentals.activate(a, id);
  }
  @Roles('ADMIN')
  @Post('agreements/:id/cancel')
  cancelAgreement(@CurrentActor() a: RequestActor, @Param('id') id: string, @Body(zbody(reasonSchema)) b: z.infer<typeof reasonSchema>) {
    return this.rentals.cancelDraft(a, id, b.reason);
  }
  @Roles('ADMIN')
  @Post('agreements/:id/amendments')
  amend(@CurrentActor() a: RequestActor, @Param('id') id: string, @Body(zbody(amendmentSchema)) b: z.infer<typeof amendmentSchema>) {
    return this.rentals.amend(a, id, b);
  }
  @Roles('ADMIN')
  @Post('agreements/:id/terminate')
  terminate(@CurrentActor() a: RequestActor, @Param('id') id: string, @Body(zbody(terminationSchema)) b: z.infer<typeof terminationSchema>) {
    return this.rentals.terminate(a, id, b.terminationDate, b.reason);
  }
  @Roles('ADMIN')
  @Post('agreements/:id/renew')
  renew(@CurrentActor() a: RequestActor, @Param('id') id: string, @Body(zbody(renewSchema)) b: z.infer<typeof renewSchema>) {
    return this.rentals.renew(a, id, b);
  }
  @Post('agreements/:id/deposits')
  deposit(@CurrentActor() a: RequestActor, @Param('id') id: string, @Body(zbody(depositSchema)) b: z.infer<typeof depositSchema>) {
    return this.rentals.recordDeposit(a, id, b);
  }

  // Collections
  @Get('collections')
  collections(@CurrentActor() a: RequestActor, @Query('filter') filter: 'OVERDUE' | 'DUE_SOON' | 'ALL_OPEN' = 'ALL_OPEN') {
    return this.rentals.collections(a, ['OVERDUE', 'DUE_SOON', 'ALL_OPEN'].includes(filter) ? filter : 'ALL_OPEN');
  }
  @Post('obligations/:id/payments')
  pay(@CurrentActor() a: RequestActor, @Param('id') id: string, @Body(zbody(recordPaymentSchema)) b: z.infer<typeof recordPaymentSchema>) {
    return this.rentals.recordPayment(a, id, b);
  }
  @Roles('ADMIN')
  @Post('obligations/entries/reverse')
  reverse(@CurrentActor() a: RequestActor, @Body(zbody(reversalSchema)) b: z.infer<typeof reversalSchema>) {
    return this.rentals.reverse(a, b.entryId, b.reason, b.idempotencyKey);
  }
  @Roles('ADMIN')
  @Post('obligations/:id/refunds')
  refund(@CurrentActor() a: RequestActor, @Param('id') id: string, @Body(zbody(refundSchema)) b: z.infer<typeof refundSchema>) {
    return this.rentals.refund(a, id, b);
  }
  @Roles('ADMIN')
  @Post('obligations/:id/waive')
  waive(@CurrentActor() a: RequestActor, @Param('id') id: string, @Body(zbody(waiveSchema)) b: z.infer<typeof waiveSchema>) {
    return this.rentals.waive(a, id, b.reason);
  }

  // Owner payouts (admin)
  @Roles('ADMIN')
  @Get('payouts/queue')
  payoutQueue() {
    return this.rentals.payoutQueue();
  }
  @Roles('ADMIN')
  @Get('payouts/owners/:ownerId')
  ownerPayables(@CurrentActor() a: RequestActor, @Param('ownerId') ownerId: string) {
    return this.rentals.ownerStatement(a, ownerId);
  }
  @Roles('ADMIN')
  @Post('payouts')
  payout(@CurrentActor() a: RequestActor, @Body(zbody(recordPayoutSchema)) b: z.infer<typeof recordPayoutSchema>) {
    return this.rentals.recordPayout(a, b);
  }
  @Roles('ADMIN')
  @Post('payouts/:id/reverse')
  reversePayout(@CurrentActor() a: RequestActor, @Param('id') id: string, @Body(zbody(payoutReversalSchema)) b: z.infer<typeof payoutReversalSchema>) {
    return this.rentals.reversePayout(a, id, b.reason, b.idempotencyKey);
  }
}

// ---------------------------------------------------------------------------
// Parties (tenants, landlords, buyers, sellers) — their own records only
// ---------------------------------------------------------------------------
@Controller('v1/me')
export class FinancePartyController {
  constructor(
    private readonly rentals: RentalsService,
    private readonly sales: SalesService,
  ) {}

  @Get('agreements')
  agreements(@CurrentActor() a: RequestActor) {
    return this.rentals.myAgreements(a);
  }

  @Get('agreements/:id/terms')
  terms(@CurrentActor() a: RequestActor, @Param('id') id: string) {
    return this.rentals.acceptanceTerms(a, id);
  }

  @Post('agreements/:id/accept')
  accept(@CurrentActor() a: RequestActor, @Param('id') id: string, @Body(zbody(partyAcceptSchema)) b: z.infer<typeof partyAcceptSchema>) {
    return this.rentals.acceptAsParty(a, id, b.termsVersion, b.disclosedMonthlyCents);
  }

  @Get('owner-statement')
  statement(@CurrentActor() a: RequestActor) {
    return this.rentals.ownerStatement(a, a.id);
  }

  @Get('sales/:id')
  sale(@CurrentActor() a: RequestActor, @Param('id') id: string) {
    return this.sales.detail(a, id);
  }
}
