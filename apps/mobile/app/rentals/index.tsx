import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { formatDateBeirut, formatUSD } from '@dar/shared';
import { Line } from '@/components/listing';
import { Badge, Button, Card, Divider, EmptyState, ErrorState, Loading, Row, Screen, Text } from '@/components/ui';
import { get, post } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { STATUS_TONE } from '@/lib/status';
import { colors, space } from '@/lib/theme';

export default function Rentals() {
  const { dict, locale, err } = useI18n();
  const qc = useQueryClient();
  const q = useApi<any[]>(['my-agreements'], '/v1/me/agreements');
  const [busy, setBusy] = useState<string | null>(null);

  /** Shows the exact monthly figures for this party, then records acceptance. */
  const accept = async (a: any) => {
    const terms = await get<any>(`/v1/me/agreements/${a.id}/terms`);
    const monthly = terms.party === 'TENANT' ? terms.tenantMonthlyTotalCents : terms.landlordNetCents;
    const body =
      terms.party === 'TENANT'
        ? `${dict.rentals.tenantMonthly}: ${formatUSD(terms.tenantMonthlyTotalCents, locale)}\n${dict.property.includesManagementFee.replace('{fee}', formatUSD(terms.includesMonthlyFeeCents, locale))}\n${dict.property.rentFeeNote}`
        : `${dict.rentals.agreedNetRent}: ${formatUSD(terms.landlordNetCents, locale)}\n${(terms.feeDeductedFromOwner ? dict.owner.rentFeeDeducted : dict.owner.rentMonthlyFee)}: ${formatUSD(terms.platformFeeCents, locale)}`;
    Alert.alert(dict.viewing.feeDisclosureTitle, `${body}\n\n${dict.viewing.acceptTerms.replace('{version}', terms.termsVersion)}`, [
      { text: dict.common.cancel, style: 'cancel' },
      {
        text: dict.common.confirm,
        onPress: async () => {
          setBusy(a.id);
          try {
            await post(`/v1/me/agreements/${a.id}/accept`, { termsVersion: terms.termsVersion, disclosedMonthlyCents: monthly });
            qc.invalidateQueries({ queryKey: ['my-agreements'] });
          } catch (e: any) {
            Alert.alert(err(e.code));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  return (
    <Screen edges={['bottom']} refreshing={q.isRefetching} onRefresh={q.refetch}>
      {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : q.data!.length === 0 ? <EmptyState title={dict.common.emptyTitle} /> : (
        <View style={{ gap: space.lg }}>
          {q.data!.map((a) => (
            <Card key={a.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="caption">{a.ref} · {a.property.ref}</Text>
                <Badge label={a.status} tone={a.status === 'ACTIVE' ? 'green' : a.status === 'DRAFT' ? 'amber' : 'neutral'} />
              </Row>
              <Text variant="heading">{locale === 'en' && a.property.titleEn ? a.property.titleEn : a.property.titleAr}</Text>
              <Text variant="small">{formatDateBeirut(a.startDate, locale)} → {formatDateBeirut(a.endDate, locale)}</Text>
              <Divider />
              {a.party === 'TENANT' ? (
                <>
                  <Line label={dict.rentals.tenantMonthly} value={formatUSD(a.tenantMonthlyTotalCents, locale)} strong />
                  <Text variant="caption">{dict.property.includesManagementFee.replace('{fee}', formatUSD(a.includesMonthlyFeeCents, locale))}</Text>
                </>
              ) : (
                <Line label={dict.rentals.agreedNetRent} value={formatUSD(a.agreedNetRentCents, locale)} strong />
              )}
              {a.needsMyAcceptance && <Button title={dict.common.confirm} onPress={() => accept(a)} loading={busy === a.id} style={{ marginTop: space.md }} />}
              {a.periods.length > 0 && (
                <View style={{ marginTop: space.md, gap: 6 }}>
                  {a.periods.map((p: any) => (
                    <Row key={p.id} style={{ justifyContent: 'space-between' }}>
                      <View style={{ flex: 1 }}>
                        <Text variant="small" style={{ color: colors.text }}>{dict.rentals.dueDate}: {formatDateBeirut(p.dueDate, locale)}</Text>
                        <Text variant="caption">
                          {a.party === 'TENANT'
                            ? `${formatUSD(p.paidCents, locale)} / ${formatUSD(p.amountCents, locale)}`
                            : `${dict.rentals.collected}: ${formatUSD(p.collectedForYouCents, locale)} / ${formatUSD(p.agreedNetRentCents, locale)}`}
                        </Text>
                      </View>
                      <Badge label={(dict.rentals.status as any)[p.status] ?? p.status} tone={STATUS_TONE[p.status]} />
                    </Row>
                  ))}
                </View>
              )}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
