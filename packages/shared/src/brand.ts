/**
 * Centralized branding. Replace the placeholder "Dar / دار" here; the mobile
 * app (app.config.ts reads BRAND for its display name), admin dashboard and
 * notification templates all derive from this file. Store icons/splash images
 * live in apps/mobile/assets and must be replaced separately.
 */
export const BRAND = {
  name: { ar: 'دار', en: 'Dar' },
  tagline: {
    ar: 'بيع وإيجار العقارات بثقة',
    en: 'Buy, sell and rent with confidence',
  },
  legalEntityName: 'Dar Real Estate (placeholder — replace before launch)',
  contact: {
    // Placeholders. Public company contact only — never an owner's details.
    phone: '+961 0 000 000',
    email: 'hello@example.com',
    officeAddress: { ar: 'صيدا، لبنان', en: 'Saida, Lebanon' },
    hours: { ar: 'الإثنين – السبت، ٩ص – ٦م', en: 'Mon–Sat, 9am–6pm' },
  },
  web: {
    shareBaseUrl: 'https://example.com/p', // public listing share links: {shareBaseUrl}/{ref}
  },
  colors: {
    background: '#FBF8F3', // warm white
    surface: '#FFFFFF',
    surfaceMuted: '#F3EFE8',
    border: '#E6E0D6',
    text: '#22252A', // charcoal
    textMuted: '#5F646C', // 6.1:1 on background
    primary: '#1F5A44', // deep green, 7.6:1 with white text
    primaryPressed: '#17473A',
    primarySoft: '#E5EFEA',
    accent: '#B08A4E', // muted brass for small highlights only
    success: '#1F7A4D',
    warning: '#9A6B00',
    danger: '#B3261E',
    info: '#2B5C8A',
    overlay: 'rgba(20, 22, 25, 0.55)',
  },
  radius: { sm: 8, md: 12, lg: 18, xl: 24 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  fonts: {
    // Expo loads these from apps/mobile/assets/fonts (IBM Plex Sans Arabic covers Arabic + Latin).
    regular: 'IBMPlexSansArabic-Regular',
    medium: 'IBMPlexSansArabic-Medium',
    bold: 'IBMPlexSansArabic-SemiBold',
  },
  bundleIds: {
    ios: 'com.example.dar',
    android: 'com.example.dar',
  },
} as const;

export type Brand = typeof BRAND;
