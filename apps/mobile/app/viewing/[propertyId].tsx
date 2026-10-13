import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { addDays, formatBasisPoints, formatDateBeirut, formatUSD, todayInBeirut } from '@dar/shared';
import { Button, Card, Chip, EmptyState, ErrorState, Field, Loading, Row, Screen, Text } from '@/components/ui';
import { post } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { colors, space } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';

type Period = 'MORNING' | 'AFTERNOON' | 'EVENING';
interface Disclosure { kind: 'SALE' | 'RENT'; amountCents: number; rateBps: number | null; feeCents?: number; totalCents?: number; termsVersion: string }

export default function RequestViewing() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { dict, locale, err } = useI18n();
  const qc = useQueryClient();
  const terms = useApi<Disclosure>(['viewing-terms', propertyId], `/v1/listings/${propertyId}/viewing-terms`, { staleTime: 0 });
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(todayInBeirut(), i + 1)), []);
  const [slots, setSlots] = useState<{ date: string; period: Period }[]>([]);
  const [date, setDate] = useState(days[0]!);
  const [notes, setNotes] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // One key per form session: retries after a timeout never create duplicates.
  const idem = useRef(Crypto.randomUUID()).current;

  if (terms.isLoading) return <Screen><Loading /></Screen>;
  if (terms.error || !terms.data) return <Screen><ErrorState error={terms.error} onRetry={terms.refetch} /></Screen>;
  const d = terms.data;

  if (done) {
    return (
      <Screen>
        <EmptyState title={dict.viewing.submitted} body={dict.viewing.submittedBody} action={<Button title={dict.common.done} onPress={() => router.dismissTo('/requests')} />} />
      </Screen>
    );
  }

  const addSlot = (period: Period) => {
    if (slots.length >= 3 || slots.some((s) => s.date === date && s.period === period)) return;
    setSlots([...slots, { date, period }]);
  };
  const disclosure =
    d.kind === 'SALE'
      ? dict.viewing.feeDisclosureSale.replace('{rate}', formatBasisPoints(d.rateBps ?? 0)).replace('{amount}', formatUSD(d.amountCents, locale))
      : dict.viewing.feeDisclosureRent.replace('{total}', formatUSD(d.amountCents, locale)).replace('{fee}', formatUSD(d.feeCents ?? 0, locale));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await post('/v1/viewings', { propertyId, preferredSlots: slots, customerNotes: notes || null, acceptedTermsVersion: d.termsVersion, acceptedFeeCents: d.amountCents, idempotencyKey: idem });
      qc.invalidateQueries({ queryKey: ['my-viewings'] });
      setDone(true);
    } catch (e: any) {
      if (e.code === 'TERMS_CHANGED') {
        setAccepted(false);
        await terms.refetch(); // show the new figures; the customer must accept again
      }
      setError(err(e.code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Text variant="heading">{dict.viewing.preferredTimes}</Text>
      <Text variant="small" style={{ marginBottom: space.md }}>{dict.viewing.preferredTimesHint}</Text>
      <Row style={{ flexWrap: 'wrap' }}>
        {days.map((day) => <Chip key={day} label={formatDateBeirut(day, locale).replace(/\s\d{4}$/, '')} selected={date === day} onPress={() => setDate(day)} />)}
      </Row>
      <Row style={{ marginVertical: space.md, flexWrap: 'wrap' }}>
        {(['MORNING', 'AFTERNOON', 'EVENING'] as const).map((p) => (
          <Button key={p} title={`+ ${dict.viewing[p.toLowerCase() as 'morning']}`} variant="secondary" onPress={() => addSlot(p)} disabled={slots.length >= 3} />
        ))}
      </Row>
      {slots.map((s, i) => (
        <Row key={`${s.date}-${s.period}`} style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
          <Text variant="bodyStrong">{formatDateBeirut(s.date, locale)} · {dict.viewing[s.period.toLowerCase() as 'morning']}</Text>
          <Pressable onPress={() => setSlots(slots.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={dict.common.remove} hitSlop={10}>
            <Ionicons name="close-circle" size={24} color={colors.textMuted} />
          </Pressable>
        </Row>
      ))}

      <Field label={dict.viewing.notes} placeholder={dict.viewing.notesPlaceholder} value={notes} onChangeText={setNotes} multiline maxLength={1000} />

      <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }}>
        <Text variant="heading">{dict.viewing.feeDisclosureTitle}</Text>
        <Text variant="body" style={{ marginTop: space.sm }}>{disclosure}</Text>
        <Pressable
          onPress={() => setAccepted(!accepted)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: accepted }}
          style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center', marginTop: space.md, minHeight: 48 }}
        >
          <Ionicons name={accepted ? 'checkbox' : 'square-outline'} size={26} color={colors.primary} />
          <Text variant="small" style={{ flex: 1, color: colors.text }}>{dict.viewing.acceptTerms.replace('{version}', d.termsVersion)}</Text>
        </Pressable>
        <Button title={dict.viewing.viewTerms} variant="ghost" onPress={() => router.push('/legal/terms')} />
      </Card>

      {error && <Text variant="small" style={{ color: colors.danger, marginTop: space.md }} accessibilityRole="alert">{error}</Text>}
      <View style={{ marginTop: space.lg }}>
        <Button title={dict.viewing.submit} onPress={submit} loading={busy} disabled={!accepted || slots.length === 0} />
        {slots.length === 0 && <Text variant="caption" style={{ textAlign: 'center', marginTop: 6 }}>{err('SLOT_REQUIRED')}</Text>}
      </View>
    </Screen>
  );
}
