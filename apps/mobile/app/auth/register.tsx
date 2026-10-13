import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { registerSchema } from '@dar/shared';
import { Button, Field, Row, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useSettings } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { colors, space } from '@/lib/theme';

export default function Register() {
  const { dict, err, locale } = useI18n();
  const { register } = useAuth();
  const settings = useSettings();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError(null);
    const input = { ...form, locale, acceptedTermsVersion: accepted ? settings.data?.termsVersion ?? '' : '' };
    // Same validation as the server: Lebanese phone, password strength, email.
    const r = registerSchema.safeParse(input);
    if (!r.success) {
      setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), err(i.message)])));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await register(r.data);
      router.dismissAll();
    } catch (e: any) {
      setError(err(e.code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Field label={dict.account.fullName} value={form.fullName} onChangeText={set('fullName')} autoComplete="name" error={errors.fullName} />
      <Field label={dict.account.email} value={form.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={errors.email} />
      <Field label={dict.account.phone} hint={dict.account.phoneHint} value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholder="71 123 456" autoComplete="tel" error={errors.phone} />
      <Field label={dict.account.password} value={form.password} onChangeText={set('password')} secureTextEntry autoComplete="new-password" error={errors.password} hint={err('PASSWORD_TOO_SHORT')} />
      <Pressable onPress={() => setAccepted(!accepted)} accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} style={{ minHeight: 48, justifyContent: 'center' }}>
        <Row>
          <Ionicons name={accepted ? 'checkbox' : 'square-outline'} size={26} color={colors.primary} />
          <Text variant="small" style={{ flex: 1, color: colors.text }}>{dict.account.acceptTerms}</Text>
        </Row>
      </Pressable>
      <Row style={{ marginBottom: space.md }}>
        <Button title={dict.account.terms} variant="ghost" onPress={() => router.push('/legal/terms')} />
        <Button title={dict.account.privacy} variant="ghost" onPress={() => router.push('/legal/privacy')} />
      </Row>
      {errors.acceptedTermsVersion && <Text variant="small" style={{ color: colors.danger }}>{errors.acceptedTermsVersion}</Text>}
      {error && <Text variant="small" style={{ color: colors.danger, marginBottom: space.md }} accessibilityRole="alert">{error}</Text>}
      <Button title={dict.account.signUp} onPress={submit} loading={busy} disabled={!accepted} />
    </Screen>
  );
}
