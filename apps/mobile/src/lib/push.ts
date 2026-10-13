import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { del, post } from './api';

/**
 * Optional push registration. Permission is requested only after sign-in and
 * the app works fully without it. Requires an EAS project ID; without one the
 * app simply skips push (notifications remain available in the in-app inbox).
 */
let currentToken: string | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: true }),
});

export async function registerForPush(): Promise<'registered' | 'denied' | 'unavailable'> {
  const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId;
  if (!Device.isDevice || !projectId) return 'unavailable';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'Default', importance: Notifications.AndroidImportance.DEFAULT });
  }
  const existing = await Notifications.getPermissionsAsync();
  const status = existing.granted ? existing : await Notifications.requestPermissionsAsync();
  if (!status.granted) return 'denied';
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await post('/v1/me/push-tokens', { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' });
  currentToken = token;
  return 'registered';
}

export async function unregisterPush() {
  if (currentToken) await del(`/v1/me/push-tokens/${encodeURIComponent(currentToken)}`);
  currentToken = null;
}
