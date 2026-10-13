# External integrations — status

Nothing is faked: an unconfigured integration reports itself as unconfigured (`GET /health`), and the UI never shows a success that didn't happen.

| Integration | Status | Local alternative | To enable |
|---|---|---|---|
| **Object storage** | ✅ Implemented (S3 API) | MinIO via docker-compose, or `STORAGE_DRIVER=local` (dev only) | Any S3-compatible provider (AWS S3, Cloudflare R2, Backblaze B2, Wasabi). Private bucket, set `S3_*`. |
| **Push notifications** | ✅ Implemented (Expo push API) | In-app inbox always works; status recorded as `UNCONFIGURED` | `PUSH_ENABLED=true`, optional `EXPO_ACCESS_TOKEN`, EAS project ID in the app, FCM (Android) + APNs key (iOS) uploaded to EAS. |
| **Email (password reset)** | ⚠️ Adapter only | `EMAIL_DRIVER=console` prints the link (dev only) | Implement `sendViaProvider` in `apps/api/src/modules/auth/email.service.ts` (SMTP or an HTTP email API), set `EMAIL_DRIVER=smtp` and `SMTP_URL`. Until then reset returns `EMAIL_NOT_CONFIGURED`. |
| **Phone OTP** | ⚠️ Not configured | Phones are format-validated and shown as “not verified” | Add a provider behind `/v1/auth/phone/send-code` + a verify endpoint; set `phoneVerifiedAt` only on a successful code check. |
| **OCR for photos** | ⚠️ Not configured | Manual photo review workflow | Run OCR in `MediaService.complete`, store text in `Media.ocrText`, run `detectContactInfo` on it, flag for review (never auto-approve). |
| **Online payments** | ⛔ Not in release 1 | Manual cash / bank-transfer recording | Implement `PaymentProviderAdapter` (`apps/api/src/modules/finance/payment-adapter.ts`). No card data ever touches our servers. |
| **Maps** | ✅ react-native-maps | Apple Maps on iOS; Google on Android needs a key for release builds | `GOOGLE_MAPS_ANDROID_KEY` (+ optional iOS key). Only approximate points are shown publicly. |
