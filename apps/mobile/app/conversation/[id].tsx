import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatDateTimeBeirut, type MessageDto } from '@dar/shared';
import { ErrorState, Loading, Text } from '@/components/ui';
import { get, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { colors, flipX, radius, space } from '@/lib/theme';
import { uploadAsset } from '@/lib/upload';

interface Pending { clientMessageId: string; body: string; status: 'sending' | 'failed' }

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dict, locale, rtl } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [pending, setPending] = useState<Pending[]>([]);
  const [uploading, setUploading] = useState<number | null>(null);
  const q = useQuery({ queryKey: ['messages', id], queryFn: () => get<MessageDto[]>(`/v1/conversations/${id}/messages`), refetchInterval: 15_000 });

  useEffect(() => {
    post(`/v1/conversations/${id}/read`).then(() => qc.invalidateQueries({ queryKey: ['conversations'] })).catch(() => undefined);
  }, [id, q.data?.length, qc]);

  const send = async (p: Pending, attachmentIds: string[] = []) => {
    setPending((s) => [...s.filter((x) => x.clientMessageId !== p.clientMessageId), { ...p, status: 'sending' }]);
    try {
      // The same clientMessageId on retry means the server never stores the message twice.
      await post(`/v1/conversations/${id}/messages`, { body: p.body, attachmentIds, clientMessageId: p.clientMessageId });
      setPending((s) => s.filter((x) => x.clientMessageId !== p.clientMessageId));
      q.refetch();
    } catch {
      setPending((s) => s.map((x) => (x.clientMessageId === p.clientMessageId ? { ...x, status: 'failed' } : x)));
    }
  };

  const attach = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (r.canceled || !r.assets[0]) return;
    try {
      setUploading(0);
      const m = await uploadAsset('MESSAGE_ATTACHMENT', r.assets[0], { conversationId: id }, setUploading);
      await send({ clientMessageId: Crypto.randomUUID(), body: '📎', status: 'sending' }, [m.id]);
    } catch {
      Alert.alert(dict.owner.uploadFailed);
    } finally {
      setUploading(null);
    }
  };

  const report = (m: MessageDto) =>
    Alert.alert(dict.messages.reportMessage, undefined, [
      { text: dict.common.cancel, style: 'cancel' },
      { text: dict.common.confirm, onPress: () => post('/v1/reports', { targetType: 'MESSAGE', targetId: m.id, reason: 'OFFENSIVE' }).then(() => Alert.alert('✓')) },
    ]);

  const mine = (m: MessageDto) => m.senderRole === 'CUSTOMER' && m.senderId === user?.id;
  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        {q.isLoading ? <Loading /> : q.error && !q.data ? <ErrorState error={q.error} onRetry={q.refetch} /> : (
          <FlatList
            data={[...(q.data ?? [])].reverse()}
            inverted
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: space.lg, gap: space.sm }}
            ListHeaderComponent={
              <View style={{ gap: space.sm }}>
                {pending.map((p) => (
                  <Pressable key={p.clientMessageId} onPress={() => p.status === 'failed' && send(p)} style={[styles.bubble, styles.mine, { opacity: 0.7 }]} accessibilityRole={p.status === 'failed' ? 'button' : undefined}>
                    <Text variant="body" style={{ color: colors.surface }}>{p.body}</Text>
                    <Text variant="caption" style={{ color: p.status === 'failed' ? '#FFD7D2' : colors.primarySoft }}>{p.status === 'failed' ? dict.messages.failed : dict.messages.sending}</Text>
                  </Pressable>
                ))}
              </View>
            }
            renderItem={({ item: m }) =>
              m.senderRole === 'SYSTEM' ? (
                <Text variant="caption" style={{ textAlign: 'center', marginVertical: space.sm }}>{m.body === 'viewing.requested' ? dict.viewing.submitted : m.body}</Text>
              ) : (
                <Pressable onLongPress={() => !mine(m) && report(m)} style={[styles.bubble, mine(m) ? styles.mine : styles.theirs]} accessibilityHint={!mine(m) ? dict.messages.reportMessage : undefined}>
                  {!mine(m) && <Text variant="caption" style={{ color: colors.primary }}>{m.senderRole === 'STAFF' ? `${m.senderName} · ${dict.messages.staffLabel}` : m.senderName}</Text>}
                  {m.body !== '📎' && <Text variant="body" style={{ color: mine(m) ? colors.surface : colors.text }}>{m.body}</Text>}
                  {m.attachments.map((a) => (
                    <Pressable key={a.id} onPress={() => Linking.openURL(a.url)} accessibilityRole="link"><Text variant="small" style={{ color: mine(m) ? colors.surface : colors.primary }}>📎 {a.fileName}</Text></Pressable>
                  ))}
                  <Text variant="caption" style={{ color: mine(m) ? colors.primarySoft : colors.textMuted }}>{formatDateTimeBeirut(m.createdAt, locale)}</Text>
                </Pressable>
              )
            }
          />
        )}
        <View style={styles.composer}>
          <Pressable onPress={attach} accessibilityRole="button" accessibilityLabel={dict.messages.attach} style={styles.iconBtn} disabled={uploading !== null}>
            <Ionicons name="attach" size={24} color={colors.primary} />
          </Pressable>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={uploading !== null ? dict.owner.uploading.replace('{percent}', String(Math.round(uploading * 100))) : dict.messages.placeholder}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={4000}
            accessibilityLabel={dict.messages.placeholder}
            style={[styles.input, { textAlign: rtl ? 'right' : 'left' }]}
          />
          <Pressable
            onPress={() => {
              if (!text.trim()) return;
              send({ clientMessageId: Crypto.randomUUID(), body: text.trim(), status: 'sending' });
              setText('');
            }}
            accessibilityRole="button"
            accessibilityLabel={dict.common.send}
            style={[styles.iconBtn, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="send" size={20} color={colors.surface} style={flipX()} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '82%', borderRadius: radius.lg, padding: space.md, gap: 4 },
  mine: { backgroundColor: colors.primary, alignSelf: 'flex-end' },
  theirs: { backgroundColor: colors.surface, alignSelf: 'flex-start', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, padding: space.md, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  input: { flex: 1, minHeight: 48, maxHeight: 140, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: space.md, paddingVertical: 12, fontSize: 16, fontFamily: 'IBMPlexSansArabic-Regular', color: colors.text },
  iconBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
