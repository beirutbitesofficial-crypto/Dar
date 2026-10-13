# Account deletion & data retention (draft — confirm with Lebanese counsel)

## User request
Account → “Request account deletion” → `POST /v1/me/deletion-request`. The account is flagged and appears under **Users → Account deletion requests** in the dashboard.

## Staff review (target: within 30 days)
1. Check for active leases, unpaid obligations, owner balances or open sale commissions. Anonymization is blocked while the user is party to an **active** lease.
2. Settle or document anything outstanding.
3. Click **Anonymize**.

## What anonymization does
- Replaces name and email, removes phone and password, revokes sessions, removes push tokens and favorites, blocks the account.
- Clears private owner contact fields on the user's listings.
- Writes `user.anonymized` to the audit log.

## What is retained
Financial and contractual records (agreements, obligations, ledger entries, receipts, payouts, sale closings, acceptance records, audit log) are kept — linked to the anonymized user — for the retention period required by Lebanese law for commercial and tax records. Proposed default: **10 years** from the end of the relevant agreement. Messages tied to completed transactions follow the same period; other conversations: 2 years after last activity (cleanup job not yet implemented — tracked in the release checklist).

## Backups
Backups older than the retention window must be rotated out (see DEPLOYMENT.md). Restoring a backup re-applies pending anonymizations from the audit log.
