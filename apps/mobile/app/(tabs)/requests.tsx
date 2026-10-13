import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { formatDateTimeBeirut, formatUSD, type ConversationSummary, type ViewingRequestDto } from '@dar/shared';
import { Badge, Button, Card, EmptyState, ErrorState, ListRow, Loading, Row, Screen, Segmented, Text } from '@/components/ui';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { useI18n, useLocalized } from '@/lib/i18n';
import { colors, space } from '@/lib/theme';

const TONE: Record<string, 'green' | 'amber' | 'red' | 'neutral'> = { CONFIRMED: 'green', REQUESTED: 'amber', CANCELLED: 'red', NO_SHOW: 'red', COMPLETED: 'neutral' };

export default function Requests() {
  const { dict, locale } = useI18n();
  const loc = useLocalized();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'viewings' | 'messages'>('viewings');
  const viewings = useApi<ViewingRequestDto[]>(['my-viewings'], user ? '/v1/me/viewings' : null);
  const convs = useApi<ConversationSummary[]>(['conversations'], user ? '/v1/conversations' : null, { refetchInterval: 30_000 });
  const unread = (convs.data ?? []).reduce((s, c) => s + c.unreadCount, 0);

  if (!user) {
    return (
      <Screen>
        <Text variant="title" style={{ marginBottom: space.lg }}>{dict.requests.title}</Text>
        <EmptyState title={dict.common.signInRequired} action={<Button title={dict.account.signIn} onPress={() => router.push('/auth/login')} />} />
      </Screen>
    );
  }

  const cancel = (v: ViewingRequestDto) =>
    Alert.alert(dict.viewing.cancelConfirm, undefined, [
      { text: dict.common.no, style: 'cancel' },
      { text: dict.common.yes, style: 'destructive', onPress: () => post(`/v1/me/viewings/${v.id}/cancel`).then(() => qc.invalidateQueries({ queryKey: ['my-viewings'] })) },
    ]);

  return (
    <Screen refreshing={viewings.isRefetching || convs.isRefetching} onRefresh={() => { viewings.refetch(); convs.refetch(); }}>
      <Text variant="title" accessibilityRole="header" style={{ marginBottom: space.lg }}>{dict.requests.title}</Text>
      <Segmented value={tab} onChange={setTab} options={[{ value: 'viewings', label: dict.requests.viewings }, { value: 'messages', label: unread ? `${dict.requests.messages} (${unread})` : dict.requests.messages }]} />
      <View style={{ marginTop: space.lg, gap: space.md }}>
        {tab === 'viewings' ? (
          viewings.isLoading ? <Loading /> : viewings.error ? <ErrorState error={viewings.error} onRetry={viewings.refetch} /> : viewings.data!.length === 0 ? (
            <EmptyState title={dict.requests.empty} body={dict.requests.emptyBody} action={<Button title={dict.tabs.search} variant="secondary" onPress={() => router.push('/search')} />} />
          ) : viewings.data!.map((v) => (
            <Card key={v.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="caption">{v.propertyRef}</Text>
                <Badge label={dict.viewingStatus[v.status]} tone={TONE[v.status]} />
              </Row>
              <Text variant="bodyStrong" style={{ marginTop: 4 }} onPress={() => router.push(`/listing/${v.propertyId}`)}>{loc(v.propertyTitle)}</Text>
              {v.scheduledAt ? (
                <Text variant="body" style={{ color: colors.primary }}>{dict.viewing.scheduledFor.replace('{date}', formatDateTimeBeirut(v.scheduledAt, locale))}</Text>
              ) : (
                <Text variant="small">{v.preferredSlots.map((s) => `${s.date} · ${dict.viewing[s.period.toLowerCase() as 'morning']}`).join('\n')}</Text>
              )}
              {(v as any).meetingInstructions && <Text variant="small">{dict.viewing.instructions}: {(v as any).meetingInstructions}</Text>}
              {v.assignedEmployeeName && <Text variant="caption">{dict.viewing.yourAgent.replace('{name}', v.assignedEmployeeName)}</Text>}
              <Text variant="caption">
                {v.disclosedFee.kind === 'RENT' ? `${dict.property.monthlyTotal}: ${formatUSD(v.disclosedFee.amountCents, locale)}` : `${dict.property.buyerCommission.replace(' ({rate})', '')}: ${formatUSD(v.disclosedFee.amountCents, locale)}`} · v{v.disclosedFee.termsVersion}
              </Text>
              <Row style={{ marginTop: space.sm, flexWrap: 'wrap' }}>
                {v.conversationId && <Button title={dict.requests.messages} variant="secondary" icon="chatbubble-outline" onPress={() => router.push(`/conversation/${v.conversationId}`)} />}
                {(v.status === 'REQUESTED' || v.status === 'CONFIRMED') && (
                  <>
                    <Button title={dict.viewing.reschedule} variant="ghost" onPress={() => router.push(`/viewing/${v.propertyId}`)} />
                    <Button title={dict.viewing.cancel} variant="ghost" onPress={() => cancel(v)} />
                  </>
                )}
              </Row>
            </Card>
          ))
        ) : convs.isLoading ? <Loading /> : convs.error ? <ErrorState error={convs.error} onRetry={convs.refetch} /> : convs.data!.length === 0 ? (
          <EmptyState title={dict.messages.empty} action={<Button title={dict.messages.newConversation} variant="secondary" onPress={() => router.push('/conversation/new')} />} />
        ) : (
          <Card style={{ padding: space.sm }}>
            {convs.data!.map((c) => (
              <ListRow
                key={c.id}
                icon="chatbubbles-outline"
                title={c.subject}
                subtitle={c.lastMessagePreview ?? (c.staffName ? `${c.staffName} · ${dict.messages.staffLabel}` : dict.messages.staffLabel)}
                onPress={() => router.push(`/conversation/${c.id}`)}
                right={c.unreadCount ? <Badge label={String(c.unreadCount)} tone="red" /> : undefined}
              />
            ))}
          </Card>
        )}
      </View>
    </Screen>
  );
}
