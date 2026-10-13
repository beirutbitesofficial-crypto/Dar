import { View } from 'react-native';
import { formatDateBeirut, formatUSD } from '@dar/shared';
import { Line } from '@/components/listing';
import { Badge, Card, EmptyState, ErrorState, Loading, Row, Screen, Text } from '@/components/ui';
import { useApi } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { STATUS_TONE } from '@/lib/status';
import { colors, space } from '@/lib/theme';

/** Owner statement: agreed net rent vs. what was actually collected and transferred. */
export default function Statement() {
  const { dict, locale } = useI18n();
  const q = useApi<any>(['owner-statement'], '/v1/me/owner-statement');
  if (q.isLoading) return <Screen><Loading /></Screen>;
  if (q.error) return <Screen><ErrorState error={q.error} onRetry={q.refetch} /></Screen>;
  const s = q.data;
  return (
    <Screen edges={['bottom']} refreshing={q.isRefetching} onRefresh={q.refetch}>
      <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }}>
        <Line label={dict.rentals.payable} value={formatUSD(s.totals.payableCents, locale)} strong />
        <Line label={dict.rentals.payoutsToYou} value={formatUSD(s.totals.paidOutCents, locale)} />
        {s.totals.ownerDebtCents > 0 && <Line label="⚠" value={formatUSD(s.totals.ownerDebtCents, locale)} />}
        <Text variant="caption">{dict.owner.rentNote}</Text>
      </Card>
      {s.lines.length === 0 ? <EmptyState title={dict.common.emptyTitle} /> : (
        <View style={{ gap: space.md, marginTop: space.lg }}>
          {s.lines.map((l: any) => (
            <Card key={l.obligationId}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="caption">{l.agreementRef} · {l.period}</Text>
                <Badge label={(dict.rentals.status as any)[l.status] ?? l.status} tone={STATUS_TONE[l.status]} />
              </Row>
              <Line label={dict.rentals.agreedNetRent} value={formatUSD(l.agreedNetRentCents, locale)} />
              <Line label={dict.rentals.collected} value={formatUSD(l.collectedForOwnerCents, locale)} />
              <Line label={dict.rentals.paidOut} value={formatUSD(l.paidOutCents, locale)} />
              <Line label={dict.rentals.payable} value={formatUSD(l.payableCents, locale)} strong />
            </Card>
          ))}
          <Text variant="heading" style={{ marginTop: space.md }}>{dict.rentals.payoutsToYou}</Text>
          {s.payouts.map((p: any) => (
            <Row key={p.id} style={{ justifyContent: 'space-between' }}>
              <Text variant="small">{p.ref} · {formatDateBeirut(p.paidOn, locale)} · {p.reference}</Text>
              <Text variant="bodyStrong">{formatUSD(p.totalCents, locale)}</Text>
            </Row>
          ))}
        </View>
      )}
    </Screen>
  );
}
