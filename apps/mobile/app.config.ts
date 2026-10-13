import type { ExpoConfig } from 'expo/config';
// Expo evaluates this file with a plain CommonJS loader, which cannot import the
// shared TypeScript source; tsx's require hook lets us keep a single brand file.
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('tsx/cjs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { BRAND } = require('../../packages/shared/src/brand') as typeof import('../../packages/shared/src/brand');

/**
 * App configuration. Branding (name, bundle IDs, colors) comes from the shared
 * BRAND object. Replace the placeholder icons in ./assets before release.
 * EAS project ID and API URL come from environment variables (see .env.example).
 */
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

const config: ExpoConfig = {
  name: BRAND.name.ar,
  slug: 'dar',
  scheme: 'dar',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: { image: './assets/splash.png', resizeMode: 'contain', backgroundColor: BRAND.colors.background },
  ios: {
    bundleIdentifier: BRAND.bundleIds.ios,
    buildNumber: '1',
    supportsTablet: false,
    infoPlist: {
      NSPhotoLibraryUsageDescription: 'لإضافة صور عقارك · To add photos of your property',
      NSCameraUsageDescription: 'لتصوير عقارك · To take photos of your property',
      ITSAppUsesNonExemptEncryption: false,
      CFBundleDevelopmentRegion: 'ar',
      CFBundleLocalizations: ['ar', 'en'],
    },
    config: process.env.GOOGLE_MAPS_IOS_KEY ? { googleMapsApiKey: process.env.GOOGLE_MAPS_IOS_KEY } : undefined,
  },
  android: {
    package: BRAND.bundleIds.android,
    versionCode: 1,
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: BRAND.colors.primary },
    permissions: ['CAMERA', 'READ_MEDIA_IMAGES'],
    blockedPermissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'RECORD_AUDIO'],
    config: process.env.GOOGLE_MAPS_ANDROID_KEY ? { googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_KEY } } : undefined,
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    ['expo-localization', { supportsRTL: true }],
    ['expo-notifications', { color: BRAND.colors.primary }],
    ['expo-image-picker', { photosPermission: 'لإضافة صور عقارك · To add photos of your property', cameraPermission: 'لتصوير عقارك · To take photos of your property', microphonePermission: false }],
    'expo-font',
  ],
  experiments: { typedRoutes: false },
  extra: {
    apiUrl: API_URL,
    supportsRTL: true,
    eas: process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined,
  },
  updates: process.env.EAS_PROJECT_ID ? { url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID}` } : undefined,
  runtimeVersion: { policy: 'appVersion' },
};

export default config;
