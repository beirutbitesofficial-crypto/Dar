import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Locale } from '@dar/shared';
import { AuthProvider } from '@/lib/auth';
import { bootLocale, I18nProvider, useI18n } from '@/lib/i18n';
import { colors, fonts } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: (count, e: any) => e?.status !== 401 && e?.status !== 403 && e?.status !== 404 && count < 2, networkMode: 'offlineFirst' },
    mutations: { networkMode: 'online' },
  },
});

function Navigator() {
  const { dict } = useI18n();
  // Open the related screen when a notification is tapped.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const d = r.notification.request.content.data as Record<string, string>;
      if (d.conversationId) router.push(`/conversation/${d.conversationId}`);
      else if (d.viewingId) router.push('/(tabs)/requests');
      else if (d.propertyId) router.push(`/owner/${d.propertyId}`);
      else if (d.agreementId || d.obligationId) router.push('/rentals');
      else router.push('/notifications');
    });
    return () => sub.remove();
  }, []);
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { fontFamily: fonts.bold, color: colors.text },
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
        headerBackTitle: dict.common.back,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="listing/[id]" options={{ title: '', headerTransparent: true }} />
      <Stack.Screen name="viewing/[propertyId]" options={{ title: dict.viewing.title, presentation: 'modal' }} />
      <Stack.Screen name="filters" options={{ title: dict.search.filters, presentation: 'modal' }} />
      <Stack.Screen name="conversation/[id]" options={{ title: dict.messages.title }} />
      <Stack.Screen name="conversation/new" options={{ title: dict.property.askTeam, presentation: 'modal' }} />
      <Stack.Screen name="auth/login" options={{ title: dict.account.signIn, presentation: 'modal' }} />
      <Stack.Screen name="auth/register" options={{ title: dict.account.signUp }} />
      <Stack.Screen name="auth/forgot" options={{ title: dict.account.forgotPassword }} />
      <Stack.Screen name="reset-password" options={{ title: dict.account.forgotPassword }} />
      <Stack.Screen name="owner/index" options={{ title: dict.owner.myListings }} />
      <Stack.Screen name="owner/[id]" options={{ title: dict.owner.myListings }} />
      <Stack.Screen name="owner/edit/[id]" options={{ title: dict.owner.newListing }} />
      <Stack.Screen name="rentals/index" options={{ title: dict.rentals.title }} />
      <Stack.Screen name="statement" options={{ title: dict.rentals.statement }} />
      <Stack.Screen name="notifications" options={{ title: dict.account.notifications }} />
      <Stack.Screen name="legal/[kind]" options={{ title: '' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [locale, setLocale] = useState<Locale | null>(null);
  const [fontsLoaded] = useFonts({
    [fonts.regular]: IBMPlexSansArabic_400Regular,
    [fonts.medium]: IBMPlexSansArabic_500Medium,
    [fonts.bold]: IBMPlexSansArabic_600SemiBold,
  });
  useEffect(() => {
    bootLocale().then(setLocale);
  }, []);
  useEffect(() => {
    if (fontsLoaded && locale) SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded, locale]);
  if (!fontsLoaded || !locale) return null;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <I18nProvider initial={locale}>
          <AuthProvider>
            <StatusBar style="dark" />
            <Navigator />
          </AuthProvider>
        </I18nProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
