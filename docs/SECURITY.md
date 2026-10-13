# Security & privacy controls

## Authorization
- Every protected route passes the global `AuthGuard` (JWT + live session + live user record), and **every record-level decision** calls a function in `packages/shared/src/domain/policy.ts` (unit-tested). Hiding UI is never relied on.
- Coarse role gates (`@Roles`) plus record checks (assignment, ownership, party to an agreement).
- Blocked users lose all sessions immediately.

## Private data
- Owner contact fields, exact address, precise coordinates, private documents and internal notes are **never selected** by public queries (`PUBLIC_SELECT`), serialized through an allowlist (`toPublicListing`), and every public payload is scanned for forbidden keys (`assertNoPrivateFields`) before it leaves the API.
- Public map pins are the **town centroid** plus a deterministic offset from the listing id — never derived from the real coordinates.
- Viewing activity shown to owners contains only status and dates.
- Staff access to owner contacts, exact locations, customer contacts and private documents is written to the audit log (`sensitive.*`).
- CSV exports exclude owner contacts and exact addresses, are admin-only and audited; cells are protected against formula injection.
- Share links contain only the public reference (`/p/DAR-1001`).
- Software cannot prevent parties from exchanging contact details after meeting in person; the platform does not claim otherwise.

## Contact information in listings
- Text is scanned on save/submit (`detectContactInfo`: Arabic-Indic/Persian digits, separators, spelled-out digits in Lebanese Arabic and English, emails incl. “at/dot” obfuscation, WhatsApp/social/handles/links). Findings are shown to the owner and flagged to moderators. Detection assists humans; every listing is reviewed before publication.
- Photos: a manual review workflow (approve/reject per photo with a reason). OCR is an optional, unconfigured integration (`OCR_PROVIDER`); detection inside images is not claimed.

## Uploads
- Intent → signed PUT (short TTL) → server-side completion. Size and type limits per kind; the real type is detected from file bytes; declared type must match.
- Images are decoded and re-encoded with `sharp` (EXIF/GPS/XMP removed, orientation applied, max 2560 px, pixel-count limit against decompression bombs).
- **Videos are stored unmodified** and may contain location metadata; they are always manually reviewed and should be re-exported before publishing if needed.
- Raw uploads are deleted after processing. Downloads use expiring signed URLs; private documents get 2-minute links and are audited.

## Sessions & credentials
- Argon2id password hashing; generic login errors; lockout after 8 failed attempts (15 min); dummy hash on unknown emails to avoid timing leaks.
- Refresh tokens: random 256-bit, stored as HMAC with a server pepper, rotated on every use; reuse revokes the whole family.
- Mobile tokens in the OS keychain/keystore (SecureStore). Admin tokens in `httpOnly`, `SameSite=Strict` cookies, `Secure` in production.
- Password reset tokens: single-use, 30 minutes, all sessions revoked after reset.
- Phone numbers are format-validated for Lebanon but **never marked verified** without a real OTP provider.

## Abuse protection
- Global rate limit (120/min/IP) plus stricter limits on auth, viewing requests, messages and reports.
- Report → resolve workflow for listings, messages and users; staff can hide messages; admins can block users.

## Logging
- Access logs contain method, path (no query string), status, duration, request id and user id — no bodies, tokens, emails or phone numbers. Error logs scrub emails, numbers and token-like strings. Prisma query logging is disabled.

## Secrets
- Only `*.env.example` files are committed. Production refuses placeholder secrets, console email, local storage and empty CORS origins at startup.
