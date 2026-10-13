import { useState } from 'react';
import { Button, Field, Screen, Text } from '@/components/ui';
import { post } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { colors, space } from '@/lib/theme';

export default function Forgot() {
  const { dict, err } = useI18n();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await post('/v1/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (e: any) {
      // EMAIL_NOT_CONFIGURED is shown honestly instead of pretending an email was sent.
      setError(e.code === 'EMAIL_NOT_CONFIGURED' ? `${err('GENERIC')} (email)` : err(e.code));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen edges={['bottom']}>
      {sent ? (
        <Text variant="body">{dict.account.resetSent}</Text>
      ) : (
        <>
          <Field label={dict.account.email} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          {error && <Text variant="small" style={{ color: colors.danger, marginBottom: space.md }}>{error}</Text>}
          <Button title={dict.common.send} onPress={submit} loading={busy} disabled={!email} />
        </>
      )}
    </Screen>
  );
}
