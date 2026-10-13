import { router } from 'expo-router';
import { useState } from 'react';
import { Button, Field, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { colors, space } from '@/lib/theme';

export default function Login() {
  const { dict, err } = useI18n();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      router.back();
    } catch (e: any) {
      setError(err(e.code));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen edges={['bottom']}>
      <Field label={dict.account.email} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" style={{ writingDirection: 'ltr' }} />
      <Field label={dict.account.password} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={submit} />
      {error && <Text variant="small" style={{ color: colors.danger, marginBottom: space.md }} accessibilityRole="alert">{error}</Text>}
      <Button title={dict.account.signIn} onPress={submit} loading={busy} disabled={!email || !password} />
      <Button title={dict.account.forgotPassword} variant="ghost" onPress={() => router.push('/auth/forgot')} style={{ marginTop: space.sm }} />
      <Text variant="small" style={{ textAlign: 'center', marginTop: space.xl }}>{dict.account.noAccount}</Text>
      <Button title={dict.account.signUp} variant="secondary" onPress={() => router.replace('/auth/register')} style={{ marginTop: space.sm }} />
    </Screen>
  );
}
