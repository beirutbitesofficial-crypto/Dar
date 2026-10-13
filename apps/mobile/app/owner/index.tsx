import { Image } from 'expo-image';
import { router } from 'expo-router';
import { View } from 'react-native';
import { formatUSD, type OwnerListingSummary } from '@dar/shared';
import { Badge, Button, Card, EmptyState, ErrorState, Loading, Row, Screen, Text } from '@/components/ui';
import { useApi } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { STATUS_TONE } from '@/lib/status';
import { colors, radius, space } from '@/lib/theme';


export default function MyListings() {
  const { dict, locale } = useI18n();
  const q = useApi<OwnerListingSummary[]>(['owner-listings'], '/v1/owner/properties');
  return (
    <Screen edges={['bottom']} refreshing={q.isRefetching} onRefresh={q.refetch}>
      <Button title={dict.owner.newListing} icon="add" onPress={() => router.push('/owner/edit/new')} style={{ marginBottom: space.lg }} />
      {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : q.data!.length === 0 ? (
        <EmptyState title={dict.common.emptyTitle} body={dict.home.listYourPropertyBody} />
      ) : (
        <View style={{ gap: space.md }}>
          {q.data!.map((l) => (
            <Card key={l.id} onPress={() => router.push(`/owner/${l.id}`)} accessibilityLabel={`${l.titleAr} ${dict.listingStatus[l.status]}`}>
              <Row style={{ alignItems: 'flex-start' }}>
                {l.coverUrl ? <Image source={{ uri: l.coverUrl }} style={{ width: 84, height: 84, borderRadius: radius.md }} /> : <View style={{ width: 84, height: 84, borderRadius: radius.md, backgroundColor: colors.surfaceMuted }} />}
                <View style={{ flex: 1, gap: 4 }}>
                  <Row style={{ flexWrap: 'wrap' }}>
                    <Badge label={dict.listingStatus[l.status]} tone={STATUS_TONE[l.status]} />
                    {l.hasPendingRevision && <Badge label={dict.listingStatus.PENDING_REVIEW} tone="amber" />}
                  </Row>
                  <Text variant="bodyStrong" numberOfLines={2}>{l.titleAr || dict.owner.newListing}</Text>
                  <Text variant="small">{l.ref} · {l.priceCents ? formatUSD(l.priceCents, locale) : '—'} · {dict.owner.viewingActivity}: {l.viewingCount}</Text>
                  {l.rejectionReason && <Text variant="caption" style={{ color: colors.danger }} numberOfLines={2}>{l.rejectionReason}</Text>}
                </View>
              </Row>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
