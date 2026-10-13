import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AMENITY_KEYS, parseMoneyInput, PropertyType } from '@dar/shared';
import { Button, Chip, Field, Row, Screen, Text } from '@/components/ui';
import { useLocations } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { space } from '@/lib/theme';

export default function Filters() {
  const params = useLocalSearchParams<Record<string, string>>();
  const { dict, locale } = useI18n();
  const locations = useLocations();
  const [f, setF] = useState<Record<string, string | undefined>>({ ...params });
  const set = (k: string, v: string | undefined) => setF((s) => ({ ...s, [k]: v }));
  const toggleList = (k: string, v: string) => {
    const list = (f[k] ?? '').split(',').filter(Boolean);
    set(k, (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]).join(',') || undefined);
  };
  const has = (k: string, v: string) => (f[k] ?? '').split(',').includes(v);
  const name = (l: { nameAr: string; nameEn: string }) => (locale === 'ar' ? l.nameAr : l.nameEn);
  const areas = (locations.data ?? []).filter((l) => l.kind === 'AREA');
  const towns = (locations.data ?? []).filter((l) => l.kind === 'TOWN' && l.parentId === f.areaId);
  const dollars = (cents?: string) => (cents ? String(Number(cents) / 100) : '');
  const toCents = (v: string) => (v ? String(parseMoneyInput(v) ?? '') || undefined : undefined);

  return (
    <Screen edges={['bottom']}>
      <Text variant="heading">{dict.search.location}</Text>
      <Row style={{ flexWrap: 'wrap', marginVertical: space.sm }}>
        <Chip label={dict.search.anyLocation} selected={!f.areaId} onPress={() => setF((s) => ({ ...s, areaId: undefined, townId: undefined }))} />
        {areas.map((a) => <Chip key={a.id} label={name(a)} selected={f.areaId === a.id} onPress={() => setF((s) => ({ ...s, areaId: a.id, townId: undefined }))} />)}
      </Row>
      {towns.length > 0 && (
        <Row style={{ flexWrap: 'wrap', marginBottom: space.md }}>
          {towns.map((t) => <Chip key={t.id} label={name(t)} selected={f.townId === t.id} onPress={() => set('townId', f.townId === t.id ? undefined : t.id)} />)}
        </Row>
      )}

      <Text variant="heading" style={{ marginTop: space.md }}>{dict.search.propertyType}</Text>
      <Row style={{ flexWrap: 'wrap', marginVertical: space.sm }}>
        {Object.values(PropertyType).map((p) => <Chip key={p} label={dict.propertyType[p]} selected={has('propertyType', p)} onPress={() => toggleList('propertyType', p)} />)}
      </Row>

      <Text variant="heading" style={{ marginTop: space.md }}>{dict.search.priceRange} ($)</Text>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}><Field label={dict.search.minPrice} keyboardType="numeric" defaultValue={dollars(f.minPriceCents)} onChangeText={(v) => set('minPriceCents', toCents(v))} /></View>
        <View style={{ flex: 1 }}><Field label={dict.search.maxPrice} keyboardType="numeric" defaultValue={dollars(f.maxPriceCents)} onChangeText={(v) => set('maxPriceCents', toCents(v))} /></View>
      </Row>
      <Field label={`${dict.search.minSize} (${dict.common.sqm})`} keyboardType="numeric" defaultValue={f.minSizeSqm} onChangeText={(v) => set('minSizeSqm', v.replace(/\D/g, '') || undefined)} />

      <Text variant="heading">{dict.search.bedrooms}</Text>
      <Row style={{ flexWrap: 'wrap', marginVertical: space.sm }}>
        <Chip label={dict.search.any} selected={!f.minBedrooms} onPress={() => set('minBedrooms', undefined)} />
        {['1', '2', '3', '4'].map((n) => <Chip key={n} label={`${n}+`} selected={f.minBedrooms === n} onPress={() => set('minBedrooms', n)} />)}
      </Row>

      <Text variant="heading" style={{ marginTop: space.md }}>{dict.search.furnishing}</Text>
      <Row style={{ flexWrap: 'wrap', marginVertical: space.sm }}>
        <Chip label={dict.search.any} selected={!f.furnished} onPress={() => set('furnished', undefined)} />
        <Chip label={dict.search.furnished} selected={f.furnished === 'true'} onPress={() => set('furnished', 'true')} />
        <Chip label={dict.search.unfurnished} selected={f.furnished === 'false'} onPress={() => set('furnished', 'false')} />
      </Row>

      <Text variant="heading" style={{ marginTop: space.md }}>{dict.search.amenities}</Text>
      <Row style={{ flexWrap: 'wrap', marginVertical: space.sm }}>
        {AMENITY_KEYS.map((a) => <Chip key={a} label={dict.amenities[a]} selected={has('amenities', a)} onPress={() => toggleList('amenities', a)} />)}
      </Row>

      <Text variant="heading" style={{ marginTop: space.md }}>{dict.search.sort}</Text>
      <Row style={{ flexWrap: 'wrap', marginVertical: space.sm }}>
        {([['newest', dict.search.sortNewest], ['price_asc', dict.search.sortPriceAsc], ['price_desc', dict.search.sortPriceDesc], ['size_desc', dict.search.sortSizeDesc]] as const).map(([v, l]) => (
          <Chip key={v} label={l} selected={(f.sort ?? 'newest') === v} onPress={() => set('sort', v)} />
        ))}
      </Row>

      <View style={{ gap: space.md, marginTop: space.xl }}>
        <Button title={dict.search.showResults} onPress={() => router.dismissTo({ pathname: '/search', params: Object.fromEntries(Object.entries(f).filter(([, v]) => v)) as Record<string, string> })} />
        <Button title={dict.search.resetFilters} variant="ghost" onPress={() => setF({ listingType: f.listingType })} />
      </View>
    </Screen>
  );
}
