import { router } from 'expo-router';
import { Alert, Linking, View } from 'react-native';
import { BRAND } from '@dar/shared';
import { Badge, Button, Card, Divider, ListRow, Screen, Text } from '@/components/ui';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { space } from '@/lib/theme';

export default function Account() {
  const { dict, locale, setLocale } = useI18n();
  const { user, signOut, refreshMe } = useAuth();

  const requestDeletion = () =>
    Alert.alert(dict.account.deleteAccount, dict.account.deleteAccountBody, [
      { text: dict.common.cancel, style: 'cancel' },
      {
        text: dict.common.confirm,
        style: 'destructive',
        onPress: async () => {
          await post('/v1/me/deletion-request', { confirm: true });
          await refreshMe();
          Alert.alert(dict.account.deleteRequested);
        },
      },
    ]);

  return (
    <Screen>
      <Text variant="title" accessibilityRole="header" style={{ marginBottom: space.lg }}>{dict.account.title}</Text>
      {user ? (
        <Card>
          <Text variant="heading">{user.fullName}</Text>
          <Text variant="small">{user.email}</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <Text variant="small" style={{ writingDirection: 'ltr' }}>{user.phone}</Text>
            {user.phone && !user.phoneVerified && <Badge label={dict.account.phoneNotVerified} tone="amber" />}
          </View>
          {user.deletionRequestedAt && <Badge label={dict.account.deleteRequested} tone="red" />}
        </Card>
      ) : (
        <Card>
          <Text variant="body" style={{ marginBottom: space.md }}>{dict.common.signInRequired}</Text>
          <Button title={dict.account.signIn} onPress={() => router.push('/auth/login')} />
          <Button title={dict.account.signUp} variant="ghost" onPress={() => router.push('/auth/register')} style={{ marginTop: space.sm }} />
        </Card>
      )}

      <Card style={{ marginTop: space.lg, padding: space.sm }}>
        {user && (
          <>
            <ListRow icon="business-outline" title={dict.owner.myListings} onPress={() => router.push('/owner')} />
            <ListRow icon="add-circle-outline" title={dict.home.listYourProperty} onPress={() => router.push('/owner/edit/new')} />
            <ListRow icon="key-outline" title={dict.rentals.title} onPress={() => router.push('/rentals')} />
            {user.roles.includes('OWNER') && <ListRow icon="document-text-outline" title={dict.rentals.statement} onPress={() => router.push('/statement')} />}
            <ListRow icon="notifications-outline" title={dict.account.notifications} onPress={() => router.push('/notifications')} />
            <Divider />
          </>
        )}
        <ListRow
          icon="language-outline"
          title={dict.common.language}
          subtitle={locale === 'ar' ? dict.common.arabic : dict.common.english}
          onPress={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
          right={<Text variant="bodyStrong">{locale === 'ar' ? 'English' : 'العربية'}</Text>}
        />
        <ListRow icon="document-outline" title={dict.account.terms} onPress={() => router.push('/legal/terms')} />
        <ListRow icon="shield-checkmark-outline" title={dict.account.privacy} onPress={() => router.push('/legal/privacy')} />
        <ListRow icon="call-outline" title={dict.account.contactUs} subtitle={BRAND.contact.phone} onPress={() => Linking.openURL(`tel:${BRAND.contact.phone.replace(/\s/g, '')}`)} />
      </Card>

      {user && (
        <View style={{ marginTop: space.xl, gap: space.md }}>
          <Button title={dict.account.signOut} variant="secondary" onPress={signOut} />
          {!user.deletionRequestedAt && <Button title={dict.account.deleteAccount} variant="danger" onPress={requestDeletion} />}
        </View>
      )}
    </Screen>
  );
}
