import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { formatBasisPoints, formatDateTimeBeirut, formatUSD, type OwnerViewingActivity } from '@dar/shared';
import { Line } from '@/components/listing';
import { Badge, Button, Card, ErrorState, Loading, Row, Screen, Text } from '@/components/ui';
import { post } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { colors, radius, space } from '@/lib/theme';
import { STATUS_TONE } from '@/lib/status';

export default function OwnerListing() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dict, locale, err } = useI18n();
  const qc = useQueryClient();
  const q = useApi<any>(['owner-listing', id], `/v1/owner/properties/${id}`);
  const activity = useApi<OwnerViewingActivity[]>(['owner-activity', id], `/v1/owner/properties/${id}/viewing-activity`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (q.isLoading) return <Screen><Loading /></Screen>;
  if (q.error || !q.data) return <Screen><ErrorState error={q.error} onRetry={q.refetch} /></Screen>;
  const p = q.data;

  const act = async (path: string, body?: object) => {
    setBusy(true);
    setError(null);
    try {
      await post(path, body);
      await q.refetch();
      qc.invalidateQueries({ queryKey: ['owner-listings'] });
    } catch (e: any) {
      setError(e.details?.missing ? `${dict.owner.missingFields} ${e.details.missing.join('، ')}` : err(e.code));
    } finally {
      setBusy(false);
    }
  };
  const e = p.estimate;
  const photos = (p.media as any[]).filter((m) => m.kind === 'PHOTO');

  return (
    <Screen edges={['bottom']} refreshing={q.isRefetching} onRefresh={q.refetch}>
      <Row style={{ flexWrap: 'wrap' }}>
        <Badge label={dict.listingStatus[p.status as 'DRAFT']} tone={STATUS_TONE[p.status]} />
        <Text variant="caption">{p.ref}</Text>
        {p.demo && <Badge label={dict.common.demoBadge} tone="demo" />}
      </Row>
      <Text variant="title" style={{ marginVertical: space.sm }}>{p.titleAr || dict.owner.newListing}</Text>
      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {photos.map((m) => (
            <View key={m.id}>
              <Image source={{ uri: m.url }} style={{ width: 120, height: 90, borderRadius: radius.md }} />
              {m.reviewStatus === 'REJECTED' && <Badge label={dict.listingStatus.REJECTED} tone="red" />}
            </View>
          ))}
        </ScrollView>
      )}

      {p.status === 'REJECTED' && p.rejectionReason && (
        <Card style={{ marginTop: space.lg, borderColor: colors.danger }}>
          <Text variant="heading">{dict.owner.rejectionReason}</Text>
          <Text variant="body">{p.rejectionReason}</Text>
        </Card>
      )}
      {p.pendingRevision?.status === 'PENDING' && <Text variant="small" style={{ marginTop: space.md, color: colors.warning }}>{dict.owner.pendingRevision}</Text>}
      {p.contactFlagged && <Text variant="small" style={{ marginTop: space.md, color: colors.warning }}>{dict.owner.contactDetected}</Text>}

      {e && (
        <Card style={{ marginTop: space.lg }}>
          {e.kind === 'SALE' ? (
            <>
              <Text variant="heading">{dict.owner.saleEstimateTitle}</Text>
              <Line label={dict.owner.askingPrice} value={formatUSD(e.askingPriceCents, locale)} />
              <Line label={dict.owner.sellerCommission.replace('{rate}', formatBasisPoints(e.sellerBps))} value={`− ${formatUSD(e.sellerCommissionCents, locale)}`} />
              <Line label={dict.owner.sellerProceeds} value={formatUSD(e.sellerProceedsCents, locale)} strong />
              <Text variant="caption">{dict.owner.saleEstimateNote}</Text>
            </>
          ) : (
            <>
              <Text variant="heading">{dict.owner.rentEstimateTitle}</Text>
              <Line label={dict.owner.rentYouReceive} value={formatUSD(e.landlordNetCents, locale)} strong />
              <Line label={e.feeDeductedFromOwner ? dict.owner.rentFeeDeducted : dict.owner.rentMonthlyFee} value={formatUSD(e.platformFeeCents, locale)} />
              <Line label={dict.owner.rentTenantPays} value={formatUSD(e.tenantTotalCents, locale)} />
              <Text variant="caption">{dict.owner.rentNote}</Text>
            </>
          )}
        </Card>
      )}

      <View style={{ gap: space.md, marginTop: space.lg }}>
        {['DRAFT', 'REJECTED', 'PUBLISHED', 'PAUSED', 'PENDING_REVIEW'].includes(p.status) && (
          <Button title={dict.common.edit} variant="secondary" icon="create-outline" onPress={() => router.push(`/owner/edit/${id}`)} />
        )}
        {(p.allowedTransitions as string[]).includes('PENDING_REVIEW') && (
          <Button title={p.status === 'REJECTED' ? dict.owner.resubmit : dict.owner.submitForReview} loading={busy} onPress={() => act(`/v1/owner/properties/${id}/submit`)} />
        )}
        {(p.allowedTransitions as string[]).includes('PAUSED') && <Button title={dict.owner.pause} variant="ghost" onPress={() => act(`/v1/owner/properties/${id}/status`, { to: 'PAUSED' })} />}
        {p.status === 'PAUSED' && (p.allowedTransitions as string[]).includes('PUBLISHED') && <Button title={dict.owner.resume} variant="ghost" onPress={() => act(`/v1/owner/properties/${id}/status`, { to: 'PUBLISHED' })} />}
        <Button title={dict.owner.requestChange} variant="ghost" icon="chatbubble-outline" onPress={() => router.push({ pathname: '/conversation/new', params: { ref: p.ref } })} />
        {error && <Text variant="small" style={{ color: colors.danger }} accessibilityRole="alert">{error}</Text>}
      </View>

      <Card style={{ marginTop: space.lg }}>
        <Text variant="heading">{dict.owner.viewingActivity}</Text>
        <Text variant="caption" style={{ marginBottom: space.sm }}>{dict.owner.viewingActivityNote}</Text>
        {(activity.data ?? []).length === 0 ? <Text variant="small">{dict.common.emptyTitle}</Text> : activity.data!.map((v) => (
          <Row key={v.id} style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
            <Text variant="small">{formatDateTimeBeirut(v.scheduledAt ?? v.createdAt, locale)}</Text>
            <Badge label={dict.viewingStatus[v.status]} />
          </Row>
        ))}
      </Card>
    </Screen>
  );
}
