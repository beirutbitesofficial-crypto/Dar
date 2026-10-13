import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Dimensions, FlatList, Pressable, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BRAND, formatDateBeirut, type PublicListing } from '@dar/shared';
import { PriceBlock } from '@/components/listing';
import { Badge, Button, Card, Divider, ErrorState, Loading, Row, Screen, Text } from '@/components/ui';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useFavorites } from '@/lib/favorites';
import { useApi } from '@/lib/hooks';
import { useI18n, useLocalized } from '@/lib/i18n';
import { colors, space } from '@/lib/theme';

const W = Dimensions.get('window').width;

export default function ListingDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dict, locale } = useI18n();
  const loc = useLocalized();
  const { requireAuth } = useAuth();
  const fav = useFavorites();
  const [index, setIndex] = useState(0);
  const q = useApi<PublicListing>(['listing', id], `/v1/listings/${id}`);

  if (q.isLoading) return <Screen><Loading /></Screen>;
  if (q.error || !q.data) return <Screen><ErrorState error={q.error} onRetry={q.refetch} /></Screen>;
  const l = q.data;
  const s = l.specs;
  const specs: [string, string][] = [
    [dict.property.size, s.sizeSqm ? `${s.sizeSqm} ${dict.common.sqm}` : ''],
    [dict.property.bedrooms, s.bedrooms != null ? String(s.bedrooms) : ''],
    [dict.property.bathrooms, s.bathrooms != null ? String(s.bathrooms) : ''],
    [dict.property.floor, s.floor != null ? `${s.floor}${s.totalFloors ? ` / ${s.totalFloors}` : ''}` : ''],
    [dict.property.totalFloors, s.floor == null && s.totalFloors ? String(s.totalFloors) : ''],
    [dict.property.furnished, s.furnished == null ? '' : s.furnished ? dict.common.yes : dict.common.no],
  ].filter(([, v]) => v) as [string, string][];
  const available = !l.availableFrom || l.availableFrom <= new Date().toISOString().slice(0, 10) ? dict.property.availableNow : formatDateBeirut(l.availableFrom, locale);

  // Share links contain only the public reference — never private data.
  const share = () => Share.share({ message: `${loc(l.title)}\n${BRAND.web.shareBaseUrl}/${l.ref}` });
  const report = () => {
    if (!requireAuth()) return;
    Alert.alert(dict.property.report, undefined, [
      { text: dict.common.cancel, style: 'cancel' },
      ...(['CONTACT_INFO', 'MISLEADING', 'SCAM'] as const).map((reason) => ({
        text: reason === 'CONTACT_INFO' ? 'Contact info / معلومات تواصل' : reason === 'MISLEADING' ? 'Misleading / مضلّل' : 'Scam / احتيال',
        onPress: () => post('/v1/reports', { targetType: 'LISTING', targetId: l.id, reason }).then(() => Alert.alert('✓')),
      })),
    ]);
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Row style={{ paddingEnd: space.sm }}>
              <Pressable onPress={share} accessibilityRole="button" accessibilityLabel={dict.property.share} style={styles.headerBtn}><Ionicons name="share-outline" size={22} color={colors.text} /></Pressable>
              <Pressable onPress={() => fav.toggle(l.id)} accessibilityRole="button" accessibilityLabel={fav.isFavorite(l.id) ? dict.property.unfavorite : dict.property.favorite} style={styles.headerBtn}>
                <Ionicons name={fav.isFavorite(l.id) ? 'heart' : 'heart-outline'} size={22} color={fav.isFavorite(l.id) ? colors.danger : colors.text} />
              </Pressable>
            </Row>
          ),
        }}
      />
      <Screen edges={[]} padded={false}>
        <View>
          <FlatList
            data={l.photos}
            horizontal
            pagingEnabled
            keyExtractor={(p) => p.id}
            onMomentumScrollEnd={(e) => setIndex(Math.round(Math.abs(e.nativeEvent.contentOffset.x) / W))}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item, index: i }) => (
              <Image source={{ uri: item.url }} style={{ width: W, height: W * 0.78 }} contentFit="cover" transition={200} accessibilityLabel={`${i + 1} / ${l.photos.length}`} />
            )}
          />
          {l.photos.length > 1 && <View style={styles.counter}><Text variant="caption" style={{ color: colors.surface }}>{index + 1} / {l.photos.length}</Text></View>}
        </View>
        <View style={{ padding: space.lg, gap: space.md }}>
          <Row style={{ flexWrap: 'wrap' }}>
            <Badge label={dict.listingType[l.listingType]} tone="green" />
            <Badge label={dict.propertyType[l.propertyType]} />
            {l.demo && <Badge label={dict.common.demoBadge} tone="demo" />}
          </Row>
          {l.demo && <Text variant="caption" style={{ color: colors.warning }}>{dict.common.demoNotice}</Text>}
          <Text variant="title" accessibilityRole="header">{loc(l.title)}</Text>
          <Row><Ionicons name="location-outline" size={16} color={colors.textMuted} /><Text variant="small">{[loc(l.location.neighborhoodName), loc(l.location.townName), loc(l.location.areaName)].filter(Boolean).join(locale === 'ar' ? '، ' : ', ')}</Text></Row>
          <PriceBlock listing={l} />

          <Card>
            <Text variant="heading" style={{ marginBottom: space.sm }}>{dict.property.specs}</Text>
            {specs.map(([k, v]) => (
              <Row key={k} style={{ justifyContent: 'space-between', paddingVertical: 4 }}><Text variant="small">{k}</Text><Text variant="bodyStrong">{v}</Text></Row>
            ))}
            <Row style={{ justifyContent: 'space-between', paddingVertical: 4 }}><Text variant="small">{dict.property.availableFrom}</Text><Text variant="bodyStrong">{available}</Text></Row>
          </Card>

          {l.amenities.length > 0 && (
            <Card>
              <Text variant="heading" style={{ marginBottom: space.sm }}>{dict.property.amenities}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {l.amenities.map((a) => <Badge key={a} label={dict.amenities[a] ?? a} />)}
              </View>
            </Card>
          )}

          <Text variant="heading">{dict.property.description}</Text>
          <Text variant="body">{loc(l.description)}</Text>

          <Card>
            <Text variant="heading">{dict.property.location}</Text>
            <Text variant="small">{dict.property.locationApprox}</Text>
          </Card>
          <Text variant="caption">{dict.property.managedNote}</Text>
          <Divider />
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="caption">{dict.property.ref}: {l.ref}</Text>
            <Button title={dict.property.report} variant="ghost" onPress={report} />
          </Row>
        </View>
      </Screen>
      {/* Sticky actions: viewing request and team contact. There is no owner contact. */}
      <View style={styles.actions}>
        <Button title={dict.property.askTeam} variant="secondary" style={{ flex: 1, paddingHorizontal: space.sm }} onPress={() => requireAuth() && router.push({ pathname: '/conversation/new', params: { propertyId: l.id, ref: l.ref } })} />
        <Button title={dict.property.requestViewing} style={{ flex: 1, paddingHorizontal: space.sm }} onPress={() => requireAuth() && router.push(`/viewing/${l.id}`)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', marginStart: 6 },
  counter: { position: 'absolute', bottom: space.md, end: space.md, backgroundColor: colors.overlay, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  actions: { flexDirection: 'row', gap: space.md, padding: space.lg, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});

