import { router } from 'expo-router';
import { View } from 'react-native';
import type { PublicListing } from '@dar/shared';
import { ListingCard } from '@/components/listing';
import { Button, EmptyState, ErrorState, Loading, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useFavorites } from '@/lib/favorites';
import { useApi } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { space } from '@/lib/theme';

export default function Favorites() {
  const { dict } = useI18n();
  const { user } = useAuth();
  const fav = useFavorites();
  const q = useApi<PublicListing[]>(['favorites'], user ? '/v1/me/favorites' : null);
  return (
    <Screen refreshing={q.isRefetching} onRefresh={user ? q.refetch : undefined}>
      <Text variant="title" accessibilityRole="header" style={{ marginBottom: space.lg }}>{dict.tabs.favorites}</Text>
      {!user ? (
        <EmptyState title={dict.common.signInRequired} action={<Button title={dict.account.signIn} onPress={() => router.push('/auth/login')} />} />
      ) : q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : q.data!.length === 0 ? (
        <EmptyState title={dict.common.emptyTitle} action={<Button title={dict.tabs.search} variant="secondary" onPress={() => router.push('/search')} />} />
      ) : (
        <View style={{ gap: space.lg }}>
          {q.data!.map((l) => <ListingCard key={l.id} listing={l} favorite={fav.isFavorite(l.id)} onToggleFavorite={() => fav.toggle(l.id)} />)}
        </View>
      )}
    </Screen>
  );
}
