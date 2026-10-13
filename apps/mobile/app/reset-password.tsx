import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { password as passwordSchema } from '@dar/shared';
import { Button, Field, Screen, Text } from '@/components/ui';
import { post } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { colors, space } from '@/lib/theme';

/** Opened from the reset email link: dar://reset-password?token=… */
export default function ResetPassword() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { dict, err } = useI18n();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    const r = passwordSchema.safeParse(pw);
    if (!r.success) return setError(err(r.error.issues[0]?.message));
    setBusy(true);
    setError(null);
    try {
      await post('/v1/auth/reset-password', { token, password: pw });
      router.replace('/auth/login');
    } catch (e: any) {
      setError(err(e.code));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen edges={['bottom']}>
      <Field label={dict.account.password} value={pw} onChangeText={setPw} secureTextEntry autoComplete="new-password" hint={err('PASSWORD_TOO_SHORT')} />
      {error && <Text variant="small" style={{ color: colors.danger, marginBottom: space.md }}>{error}</Text>}
      <Button title={dict.common.save} onPress={submit} loading={busy} disabled={!pw || !token} />
    </Screen>
  );
}
