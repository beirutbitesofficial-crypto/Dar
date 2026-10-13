import { Stack, useLocalSearchParams } from 'expo-router';
import { Badge, ErrorState, Loading, Screen, Text } from '@/components/ui';
import { useApi } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { space } from '@/lib/theme';

export default function Legal() {
  const { kind } = useLocalSearchParams<{ kind: 'terms' | 'privacy' }>();
  const { dict, locale } = useI18n();
  const q = useApi<any>(['legal', kind], `/v1/legal/${kind}`);
  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: kind === 'privacy' ? dict.account.privacy : dict.account.terms }} />
      {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : (
        <>
          {q.data.legalReviewPending && <Badge label="Draft — pending legal review / مسودة" tone="amber" />}
          <Text variant="caption" style={{ marginVertical: space.sm }}>v{q.data.version}</Text>
          <Text variant="body">{locale === 'en' ? q.data.bodyEn : q.data.bodyAr}</Text>
        </>
      )}
    </Screen>
  );
}
