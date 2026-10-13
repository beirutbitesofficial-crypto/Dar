import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { BRAND, type Page, type PublicListing } from '@dar/shared';
import { ListingCard } from '@/components/listing';
import { Button, Card, Chip, EmptyState, ErrorState, Loading, Screen, Segmented, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useFavorites } from '@/lib/favorites';
import { useApi, useLocations } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { colors, radius, space } from '@/lib/theme';

export default function Home() {
  const { dict, locale } = useI18n();
  const { user } = useAuth();
  const [type, setType] = useState<'SALE' | 'RENT'>('RENT');
  const fav = useFavorites();
  const areas = useLocations();
  const featured = useApi<Page<PublicListing>>(['listings', 'featured', type], `/v1/listings?featured=true&listingType=${type}&pageSize=10`);
  const recent = useApi<Page<PublicListing>>(['listings', 'recent', type], `/v1/listings?listingType=${type}&sort=newest&pageSize=10`);
  const refreshing = featured.isRefetching || recent.isRefetching;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { featured.refetch(); recent.refetch(); }}>
      <Text variant="small">{user ? `${dict.home.greeting}، ${user.fullName.split(' ')[0]}` : dict.home.greeting}</Text>
      <Text variant="display" accessibilityRole="header" style={{ marginBottom: space.lg }}>{dict.home.headline}</Text>

      <Segmented value={type} onChange={setType} options={[{ value: 'RENT', label: dict.listingType.RENT }, { value: 'SALE', label: dict.listingType.SALE }]} />

      <Pressable
        onPress={() => router.push({ pathname: '/search', params: { listingType: type } })}
        accessibilityRole="search"
        accessibilityLabel={dict.home.searchPlaceholder}
        style={styles.search}
      >
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <Text variant="body" style={{ color: colors.textMuted }}>{dict.home.searchPlaceholder}</Text>
      </Pressable>

      <Text variant="heading" style={styles.section}>{dict.home.areas}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {(areas.data ?? []).filter((l) => l.kind === 'AREA').map((a) => (
          <Chip key={a.id} label={locale === 'ar' ? a.nameAr : a.nameEn} onPress={() => router.push({ pathname: '/search', params: { listingType: type, areaId: a.id } })} />
        ))}
      </View>

      <Text variant="heading" style={styles.section}>{dict.home.featured}</Text>
      {featured.isLoading ? <Loading /> : featured.error ? <ErrorState error={featured.error} onRetry={featured.refetch} /> : (featured.data?.items.length ?? 0) === 0 ? (
        <Text variant="small">{dict.common.emptyTitle}</Text>
      ) : (
        <FlatList
          horizontal
          data={featured.data!.items}
          keyExtractor={(l) => l.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space.md, paddingVertical: 4 }}
          renderItem={({ item }) => <ListingCard listing={item} compact favorite={fav.isFavorite(item.id)} onToggleFavorite={() => fav.toggle(item.id)} />}
        />
      )}

      <Card style={{ marginTop: space.xl, backgroundColor: colors.primary, borderColor: colors.primary }}>
        <Text variant="heading" style={{ color: colors.surface }}>{dict.home.listYourProperty}</Text>
        <Text variant="small" style={{ color: colors.primarySoft, marginBottom: space.md }}>{dict.home.listYourPropertyBody}</Text>
        <Button title={dict.home.listYourProperty} variant="secondary" icon="add-circle-outline" onPress={() => router.push(user ? '/owner/edit/new' : '/auth/login')} />
      </Card>

      <Text variant="heading" style={styles.section}>{dict.home.recent}</Text>
      {recent.isLoading ? <Loading /> : recent.error ? <ErrorState error={recent.error} onRetry={recent.refetch} /> : recent.data!.items.length === 0 ? (
        <EmptyState title={dict.search.noResultsTitle} />
      ) : (
        <View style={{ gap: space.lg }}>
          {recent.data!.items.map((l) => <ListingCard key={l.id} listing={l} favorite={fav.isFavorite(l.id)} onToggleFavorite={() => fav.toggle(l.id)} />)}
          <Button title={dict.common.seeAll} variant="ghost" onPress={() => router.push({ pathname: '/search', params: { listingType: type } })} />
        </View>
      )}
      <Text variant="caption" style={{ textAlign: 'center', marginTop: space.xl }}>{BRAND.name[locale]} · {BRAND.tagline[locale]}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.xl, marginBottom: space.md },
  search: { marginTop: space.lg, minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md },
});
