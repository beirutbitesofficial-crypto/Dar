import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Button, Field, Screen, Text } from '@/components/ui';
import { post } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { colors, space } from '@/lib/theme';

export default function NewConversation() {
  const { propertyId, ref } = useLocalSearchParams<{ propertyId?: string; ref?: string }>();
  const { dict, err } = useI18n();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientMessageId = useRef(Crypto.randomUUID()).current;
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ conversationId: string }>('/v1/conversations', { propertyId, body, clientMessageId });
      router.replace(`/conversation/${r.conversationId}`);
    } catch (e: any) {
      setError(err(e.code));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen edges={['bottom']}>
      {ref && <Text variant="small" style={{ marginBottom: space.md }}>{dict.property.ref}: {ref}</Text>}
      <Text variant="body" style={{ marginBottom: space.lg }}>{dict.property.managedNote}</Text>
      <Field label={dict.messages.placeholder} value={body} onChangeText={setBody} multiline maxLength={4000} autoFocus />
      {error && <Text variant="small" style={{ color: colors.danger }}>{error}</Text>}
      <Button title={dict.common.send} onPress={send} loading={busy} disabled={!body.trim()} icon="send" />
    </Screen>
  );
}
