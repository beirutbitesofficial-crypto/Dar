# Store release checklist

Publishing requires developer accounts, signing credentials, store assets and store review. **Nothing has been submitted or published.**

## Credentials & accounts you need
| Item | Where | Notes |
|---|---|---|
| Apple Developer Program membership | developer.apple.com | Organization account (D-U-N-S number) recommended for a brokerage. |
| App Store Connect app record | appstoreconnect.apple.com | Put its ID in `apps/mobile/eas.json → submit.production.ios.ascAppId`, plus `appleTeamId`. |
| APNs key (.p8) | Apple Developer → Keys | Upload to EAS for push. |
| Google Play Console account | play.google.com/console | Organization account; identity verification can take days. |
| Play service-account JSON | Google Cloud | Save as `apps/mobile/secrets/google-play-service-account.json` (git-ignored). |
| FCM credentials | Firebase | Upload to EAS for Android push. |
| Expo account + EAS project | expo.dev, `eas init` | Set `EAS_PROJECT_ID`. |
| Google Maps Android key | Google Cloud | Restrict to the app's package + signing certificate. |
| Production API domain + TLS | your DNS/host | Set `EXPO_PUBLIC_API_URL` in `eas.json` production profile. |
| Public share domain | your DNS | `BRAND.web.shareBaseUrl`; needs a small page that renders public listing data only. |
| Email provider credentials | SMTP or HTTP API | For password resets. |
| Optional: SMS/OTP provider | — | For phone verification. |

## Assets you need
- Final brand name, logo, colors → `packages/shared/src/brand.ts`.
- App icon 1024×1024 (no transparency for iOS), Android adaptive icon foreground, splash → `apps/mobile/assets/` (current files are generated placeholders).
- Bundle IDs → `BRAND.bundleIds` (currently `com.example.dar`; must be unique and final before first upload).
- Screenshots in Arabic (and English): iPhone 6.9" and 6.5", Android phone; feature graphic 1024×500 for Play.
- Store listing text in Arabic and English, keywords, support URL, marketing URL.
- **Privacy policy URL** (required by both stores) and terms — reviewed by local counsel; set `legalReviewPending=false` via `POST /v1/admin/legal` when final.
- Data-safety (Play) and App Privacy (Apple) answers: account info (name, email, phone), photos (user-uploaded), messages, purchase-history-like records (rent payments); no tracking; no location collection from the device.
- Demo reviewer account for Apple/Google review (use a non-demo account with fictional data, or seed data clearly labelled).
- Account deletion: in-app request exists (Account → Request account deletion) — required by both stores; also publish a web deletion request URL for Play.

## Build & submit
```bash
cd apps/mobile
npx expo install --fix
eas init                              # once
eas build --profile preview --platform all     # internal testing
eas build --profile production --platform all
eas submit --platform ios --profile production
eas submit --platform android --profile production   # internal track first
```

## Before submitting
- [ ] Replace placeholder brand, icons, bundle IDs, support contacts.
- [ ] Legal texts reviewed; consent wording reviewed (in-app consent does not guarantee collection).
- [ ] Production API live over HTTPS; `/health` shows integrations as expected.
- [ ] Push tested on a physical iPhone and Android device.
- [ ] Arabic RTL: every screen checked on small (iPhone SE) and large devices; switch to English and back.
- [ ] Dynamic type / font scaling up to 160% checked; VoiceOver / TalkBack labels on tab bar, cards, buttons.
- [ ] Offline: airplane mode shows the offline banner and retry states; no crash.
- [ ] Remove or disable demo data in production (`SEED_DEMO=false`).
- [ ] Retention cleanup job for old conversations (PRIVACY_RETENTION.md) scheduled if required by counsel.
