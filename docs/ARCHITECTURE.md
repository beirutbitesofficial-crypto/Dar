# Architecture

```
packages/shared   ← single source of truth for business rules
   domain/         money, commission, rental, terms snapshots, schedule, ledger,
                   status machines, policy (authorization), public serializer,
                   contact detection, Lebanese phones, property field rules, metrics
   schemas/        Zod request validation (API authoritative, apps reuse for UX)
   i18n/           Arabic (default) + English dictionaries
   brand.ts        name, colors, contact, bundle IDs
apps/api          NestJS: controllers → services → Prisma; every protected
                  operation calls a shared policy function
apps/admin        Next.js server components + server actions; httpOnly session
apps/mobile       Expo Router; React Query; SecureStore tokens
```

The domain package has **no runtime dependencies** (only `zod` for schemas), so every calculation the apps display is the same code the API uses to charge money.

## Key decisions and assumptions

| Topic | Decision |
|---|---|
| Money | Integer US cents; BIGINT in PostgreSQL; rates in basis points (250 = 2.5%); half-up rounding to the cent using BigInt. No exchange rates anywhere. |
| Dates | Rent periods, due dates and availability are calendar dates (`DATE`) in Asia/Beirut; timestamps are UTC and displayed in Asia/Beirut. |
| Billing periods | Anchored to the lease start day, clamped at month end. Due date = first occurrence of the due day on/after the period start. |
| Partial payments | Landlord share is filled **first**, then the platform fee — the platform never earns its fee in a month where the landlord is short. Refunds reduce the fee first. |
| Proration | Explicit per agreement: `NONE` (full month for any started period) or `DAILY` (short final period, landlord and fee prorated separately). |
| Amendments | Apply from the first period starting on/after their effective date, and only to periods not yet billed. |
| Early termination | Voids later periods, adjusts the current one when DAILY proration was agreed (original amounts kept), flags any money that may need a refund decision. |
| Listing type at entry | A rental listing stores the pricing mode in force when the owner entered the price, so “$500” keeps meaning *net* or *total* consistently. |
| Edits to published listings | Sensitive fields (title, description, price, type, location, size, rooms) go into a pending revision; the approved version stays public until an admin approves. New photos on a published listing need review before appearing. |
| Leads | One open lead per (customer, property), auto-assigned to the listing's employee. Leads become WON only via an approved sale closing or an activated lease. |
| Employee permissions | Employees see only assigned properties/leads/conversations/agreements. Recording collections requires an explicit per-employee permission **and** assignment. Reversals, refunds, waivers, payouts, settings and approvals are admin-only. |
| Viewing fee disclosure | The app fetches the exact disclosure, the customer accepts it, and the API rejects the request if the accepted amount/terms version no longer match (`TERMS_CHANGED`). |
| Sessions | 15-minute JWT access tokens; rotating refresh tokens (hashed, peppered) with reuse detection; admin sessions 12h, mobile 60 days; the actor is re-read from the DB on every request so blocks/role changes are immediate. |
| Storage | Private S3-compatible bucket; clients get short-lived signed URLs only after authorization. Images are re-encoded server-side (all metadata stripped). |
| Infrastructure | One API process (stateless; jobs guarded by a DB lock), one PostgreSQL, one bucket. No queue/broker/cache required for launch. |

## Main flows

1. **Owner submission** — draft (any user becomes an owner) → photos (intent → signed PUT → complete/strip) → submit (completeness check per property type, contact detection) → `PENDING_REVIEW`.
2. **Admin approval** — moderation queue → review private details (audited) and photos → approve with an assigned employee (photos approved with it) or reject with a reason shown to the owner.
3. **Customer viewing request** — fee disclosure accepted → request (idempotent) → lead + staff conversation created → employee confirms a time (double-booking prevented in app logic **and** by a DB exclusion constraint) → outcome recorded.
4. **Sale** — employee records the final agreed price + acceptances → admin approves → buyer and seller obligations created, listing SOLD, leads closed → payments/refunds/reversals/waivers per side.
5. **Rental** — draft lease (frozen terms) → both parties accept (in app or recorded in person) → admin activates → monthly obligations generated daily, 35 days ahead → collections → owner payouts from collected rent → statements and receipts.
