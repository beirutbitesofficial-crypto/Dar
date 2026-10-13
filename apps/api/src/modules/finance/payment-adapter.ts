/**
 * PAYMENT PROVIDER ADAPTER — integration point, intentionally NOT implemented.
 *
 * Release 1 records cash and bank-transfer payments manually (staff enter the
 * amount, date, method and reference; see RentalsService.recordPayment and
 * SalesService.recordEntry). No card data is collected or stored, and no
 * payment is ever simulated as successful.
 *
 * To add an online provider later (e.g. a Lebanese bank gateway or card
 * processor), implement this interface and wire it so that:
 *  1. `createIntent` is called with an idempotency key derived from the
 *     obligation id + attempt, and returns a hosted checkout URL (card details
 *     are entered on the provider's page, never in our app or API).
 *  2. The provider's signed webhook is verified (`verifyWebhook`) and only a
 *     CONFIRMED event records a ledger PAYMENT, through the same code path as
 *     manual entries, using the provider's event id as the idempotencyKey
 *     (UNIQUE in RentLedgerEntry / SaleLedgerEntry → duplicates impossible).
 *  3. Refunds go through `refund` and are recorded as REFUND entries.
 *  4. Provider fees are recorded separately; they never reduce an owner's
 *     agreed net rent.
 */
export interface PaymentIntent {
  providerRef: string;
  checkoutUrl: string;
  expiresAt: string;
}

export type ProviderEvent =
  | { type: 'CONFIRMED'; eventId: string; providerRef: string; amountCents: number; currency: 'USD'; paidAt: string }
  | { type: 'FAILED'; eventId: string; providerRef: string; reason: string }
  | { type: 'REFUNDED'; eventId: string; providerRef: string; amountCents: number };

export interface PaymentProviderAdapter {
  readonly name: string;
  createIntent(input: { obligationId: string; amountCents: number; currency: 'USD'; payerUserId: string; idempotencyKey: string; returnUrl: string }): Promise<PaymentIntent>;
  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): ProviderEvent | null;
  refund(input: { providerRef: string; amountCents: number; idempotencyKey: string }): Promise<{ providerRef: string }>;
}

/** The configured adapter. `null` means manual recording only (the default). */
export const paymentProvider: PaymentProviderAdapter | null = null;
