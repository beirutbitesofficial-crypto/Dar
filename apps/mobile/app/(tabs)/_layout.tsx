import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useI18n } from '@/lib/i18n';
import { colors, fonts } from '@/lib/theme';

export default function TabsLayout() {
  const { dict } = useI18n();
  const icon = (name: keyof typeof Ionicons.glyphMap) => ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={(focused ? name : `${name}-outline`) as keyof typeof Ionicons.glyphMap} size={24} color={color} />
  );
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, minHeight: 60 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: dict.tabs.home, tabBarIcon: icon('home') }} />
      <Tabs.Screen name="search" options={{ title: dict.tabs.search, tabBarIcon: icon('search') }} />
      <Tabs.Screen name="favorites" options={{ title: dict.tabs.favorites, tabBarIcon: icon('heart') }} />
      <Tabs.Screen name="requests" options={{ title: dict.tabs.requests, tabBarIcon: icon('calendar') }} />
      <Tabs.Screen name="account" options={{ title: dict.tabs.account, tabBarIcon: icon('person') }} />
    </Tabs>
  );
}
