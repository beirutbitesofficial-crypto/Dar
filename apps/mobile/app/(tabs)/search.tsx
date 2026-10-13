import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import { MapView, Marker } from '@/components/map';
import type { Page, PublicListing } from '@dar/shared';
import { ListingCard, priceLine } from '@/components/listing';
import { Button, EmptyState, ErrorState, Loading, Row, Screen, Segmented, Text } from '@/components/ui';
import { get } from '@/lib/api';
import { useFavorites } from '@/lib/favorites';
import { useI18n } from '@/lib/i18n';
import { colors, radius, space } from '@/lib/theme';

export const FILTER_KEYS = ['listingType', 'propertyType', 'areaId', 'townId', 'minPriceCents', 'maxPriceCents', 'minSizeSqm', 'minBedrooms', 'furnished', 'amenities', 'sort', 'q'] as const;

export default function Search() {
  const params = useLocalSearchParams<Record<string, string>>();
  const { dict, locale, rtl } = useI18n();
  const fav = useFavorites();
  const [view, setView] = useState<'list' | 'map'>('list');
  const [q, setQ] = useState(params.q ?? '');

  const qs = useMemo(() => {
    const s = new URLSearchParams();
    for (const k of FILTER_KEYS) {
      const v = params[k];
      if (!v) continue;
      if (k === 'amenities' || k === 'propertyType') v.split(',').forEach((x) => s.append(k, x));
      else s.set(k, v);
    }
    return s.toString();
  }, [params]);
  const activeFilters = FILTER_KEYS.filter((k) => params[k] && k !== 'listingType' && k !== 'sort' && k !== 'q').length;

  const query = useInfiniteQuery({
    queryKey: ['search', qs],
    queryFn: ({ pageParam }) => get<Page<PublicListing>>(`/v1/listings?${qs}&page=${pageParam}&pageSize=20`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;

  const header = (
    <View style={{ gap: space.md, paddingBottom: space.md }}>
      <Text variant="title" accessibilityRole="header">{dict.search.title}</Text>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => router.setParams({ q })}
          returnKeyType="search"
          placeholder={dict.home.searchPlaceholder}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={dict.home.searchPlaceholder}
          style={[styles.searchInput, { textAlign: rtl ? 'right' : 'left' }]}
        />
      </View>
      <Segmented
        value={(params.listingType as 'SALE' | 'RENT') ?? 'RENT'}
        onChange={(v) => router.setParams({ listingType: v })}
        options={[{ value: 'RENT', label: dict.listingType.RENT }, { value: 'SALE', label: dict.listingType.SALE }]}
      />
      <Row style={{ justifyContent: 'space-between' }}>
        <Button title={`${dict.search.filters}${activeFilters ? ` (${activeFilters})` : ''}`} icon="options-outline" variant="secondary" onPress={() => router.push({ pathname: '/filters', params })} />
        <Button title={view === 'list' ? dict.search.mapView : dict.search.listView} icon={view === 'list' ? 'map-outline' : 'list-outline'} variant="ghost" onPress={() => setView(view === 'list' ? 'map' : 'list')} />
      </Row>
      {!query.isLoading && <Text variant="small">{dict.search.results.replace('{count}', String(total))}</Text>}
    </View>
  );

  if (view === 'map') {
    const pins = items.filter((l) => l.location.approximate);
    return (
      <Screen scroll={false}>
        {header}
        <Text variant="caption" style={{ marginBottom: space.sm }}>{dict.search.mapApproximate}</Text>
        <MapView
          style={{ flex: 1, borderRadius: radius.lg }}
          initialRegion={{ latitude: 33.64, longitude: 35.43, latitudeDelta: 0.35, longitudeDelta: 0.35 }}
          accessibilityLabel={dict.search.mapApproximate}
        >
          {pins.map((l) => (
            <Marker
              key={l.id}
              coordinate={{ latitude: l.location.approximate!.lat, longitude: l.location.approximate!.lng }}
              title={priceLine(l, locale)}
              description={locale === 'ar' ? l.title.ar : l.title.en ?? l.title.ar}
              pinColor={colors.primary}
              onCalloutPress={() => router.push(`/listing/${l.id}`)}
            />
          ))}
        </MapView>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <FlatList
        data={items}
        keyExtractor={(l) => l.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ gap: space.lg, paddingBottom: 48 }}
        renderItem={({ item }) => <ListingCard listing={item} favorite={fav.isFavorite(item.id)} onToggleFavorite={() => fav.toggle(item.id)} />}
        onRefresh={() => query.refetch()}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onEndReachedThreshold={0.4}
        onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
        ListEmptyComponent={
          query.isLoading ? <Loading /> : query.error ? <ErrorState error={query.error} onRetry={query.refetch} /> : (
            <EmptyState title={dict.search.noResultsTitle} body={dict.search.noResultsBody} action={<Button title={dict.search.resetFilters} variant="secondary" onPress={() => router.setParams(Object.fromEntries(FILTER_KEYS.map((k) => [k, undefined])) as any)} />} />
          )
        }
        ListFooterComponent={query.isFetchingNextPage ? <Loading /> : null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchBox: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md },
  searchInput: { flex: 1, fontSize: 16, fontFamily: 'IBMPlexSansArabic-Regular', color: colors.text, minHeight: 48 },
});

