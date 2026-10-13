import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { formatDateTimeBeirut } from '@dar/shared';
import { Card, EmptyState, ErrorState, Loading, Screen, Text } from '@/components/ui';
import { post } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { colors, space } from '@/lib/theme';

/** In-app inbox. Works whether or not push notifications are enabled. */
export default function Notifications() {
  const { dict, locale } = useI18n();
  const qc = useQueryClient();
  const q = useApi<{ items: any[]; unread: number }>(['notifications'], '/v1/me/notifications');
  useEffect(() => {
    if (q.data?.unread) post('/v1/me/notifications/read', { ids: 'all' }).then(() => qc.invalidateQueries({ queryKey: ['notifications'] }));
  }, [q.data?.unread, qc]);
  if (q.isLoading) return <Screen><Loading /></Screen>;
  if (q.error) return <Screen><ErrorState error={q.error} onRetry={q.refetch} /></Screen>;
  return (
    <Screen edges={['bottom']} refreshing={q.isRefetching} onRefresh={q.refetch}>
      {q.data!.items.length === 0 ? <EmptyState title={dict.common.emptyTitle} /> : (
        <View style={{ gap: space.md }}>
          {q.data!.items.map((n) => (
            <Card
              key={n.id}
              style={!n.readAt ? { borderColor: colors.primary } : undefined}
              onPress={() => {
                const d = n.data ?? {};
                if (d.conversationId) router.push(`/conversation/${d.conversationId}`);
                else if (d.propertyId) router.push(`/owner/${d.propertyId}`);
                else if (d.agreementId || d.obligationId) router.push('/rentals');
                else if (d.viewingId) router.push('/requests');
              }}
            >
              <Text variant="bodyStrong">{n.title}</Text>
              <Text variant="small">{n.body}</Text>
              <Text variant="caption">{formatDateTimeBeirut(n.createdAt, locale)}</Text>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
