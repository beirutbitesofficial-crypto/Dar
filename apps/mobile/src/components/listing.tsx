import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { countLabel, formatBasisPoints, formatUSD, type PublicListing } from '@dar/shared';
import { useI18n, useLocalized } from '@/lib/i18n';
import { colors, radius, shadow, space } from '@/lib/theme';
import { Badge, Row, Text } from './ui';

export function priceLine(l: PublicListing, locale: 'ar' | 'en') {
  return l.pricing.kind === 'SALE' ? formatUSD(l.pricing.askingPriceCents, locale) : formatUSD(l.pricing.tenantMonthlyTotalCents, locale);
}

export function ListingCard({ listing, compact, favorite, onToggleFavorite }: { listing: PublicListing; compact?: boolean; favorite?: boolean; onToggleFavorite?: () => void }) {
  const { dict, locale } = useI18n();
  const loc = useLocalized();
  const cover = listing.photos.find((p) => p.isCover) ?? listing.photos[0];
  const specs = [
    listing.specs.sizeSqm ? `${listing.specs.sizeSqm} ${dict.common.sqm}` : null,
    listing.specs.bedrooms != null ? countLabel(locale, listing.specs.bedrooms, 'bedrooms') : null,
    listing.specs.bathrooms != null ? countLabel(locale, listing.specs.bathrooms, 'bathrooms') : null,
  ].filter(Boolean);
  const title = loc(listing.title);
  const place = `${loc(listing.location.townName)}${locale === 'ar' ? '، ' : ', '}${loc(listing.location.areaName)}`;
  return (
    <Pressable
      onPress={() => router.push(`/listing/${listing.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${place}. ${priceLine(listing, locale)}`}
      style={({ pressed }) => [styles.card, compact && { width: 280 }, { opacity: pressed ? 0.92 : 1 }]}
    >
      <View>
        {cover ? (
          <Image source={{ uri: cover.url }} style={[styles.image, compact && { height: 170 }]} contentFit="cover" transition={200} accessibilityIgnoresInvertColors />
        ) : (
          <View style={[styles.image, { alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="image-outline" size={32} color={colors.border} /></View>
        )}
        <View style={styles.badges}>
          <Badge label={dict.listingType[listing.listingType]} tone="green" />
          {listing.demo && <Badge label={dict.common.demoBadge} tone="demo" />}
        </View>
        {onToggleFavorite && (
          <Pressable
            onPress={onToggleFavorite}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={favorite ? dict.property.unfavorite : dict.property.favorite}
            style={styles.fav}
          >
            <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={22} color={favorite ? colors.danger : colors.text} />
          </Pressable>
        )}
      </View>
      <View style={{ padding: space.md, gap: 4 }}>
        <Text variant="price">
          {priceLine(listing, locale)}
          {listing.pricing.kind === 'RENT' && <Text variant="small"> {dict.common.perMonth}</Text>}
        </Text>
        <Text variant="bodyStrong" numberOfLines={1}>{title}</Text>
        <Row><Ionicons name="location-outline" size={14} color={colors.textMuted} /><Text variant="small" numberOfLines={1}>{place}</Text></Row>
        {specs.length > 0 && <Text variant="caption">{specs.join(' · ')}</Text>}
      </View>
    </Pressable>
  );
}

/** Price + fee disclosure exactly as the API computed it — no hidden charges. */
export function PriceBlock({ listing }: { listing: PublicListing }) {
  const { dict, locale } = useI18n();
  const p = listing.pricing;
  if (p.kind === 'SALE') {
    return (
      <View style={styles.priceBox}>
        <Line label={dict.property.askingPrice} value={formatUSD(p.askingPriceCents, locale)} strong />
        <Line label={dict.property.buyerCommission.replace('{rate}', formatBasisPoints(p.buyerBps))} value={formatUSD(p.buyerCommissionCents, locale)} />
        <Line label={dict.property.totalWithCommission} value={formatUSD(p.buyerTotalCents, locale)} strong />
        <Text variant="caption">{dict.property.salePriceNote}</Text>
      </View>
    );
  }
  return (
    <View style={styles.priceBox}>
      <Text variant="small">{dict.property.monthlyTotal}</Text>
      <Text variant="display" style={{ color: colors.primary }}>{formatUSD(p.tenantMonthlyTotalCents, locale)} <Text variant="small">{dict.common.perMonth}</Text></Text>
      <Text variant="small">{dict.property.includesManagementFee.replace('{fee}', formatUSD(p.includesMonthlyFeeCents, locale))}</Text>
      <Text variant="caption">{dict.property.rentFeeNote}</Text>
    </View>
  );
}

export function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Text variant={strong ? 'bodyStrong' : 'small'} style={{ flex: 1 }}>{label}</Text>
      <Text variant={strong ? 'bodyStrong' : 'small'} style={{ fontVariant: ['tabular-nums'] }}>{value}</Text>
    </Row>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadow },
  image: { width: '100%', height: 210, backgroundColor: colors.surfaceMuted },
  badges: { position: 'absolute', top: space.sm, start: space.sm, flexDirection: 'row', gap: 6 },
  fav: { position: 'absolute', top: space.sm, end: space.sm, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  priceBox: { backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: space.lg, gap: 8 },
});
