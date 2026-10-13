import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useI18n } from '@/lib/i18n';
import { useOnline } from '@/lib/hooks';
import { colors, flipX, radius, shadow, space, TOUCH, type } from '@/lib/theme';

type Variant = keyof typeof type;

export function Text({ variant = 'body', style, ...p }: TextProps & { variant?: Variant }) {
  return <RNText {...p} style={[type[variant], { writingDirection: 'auto' }, style]} maxFontSizeMultiplier={1.6} />;
}

export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  edges = ['top'],
  padded = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: Edge[];
  padded?: boolean;
}) {
  const online = useOnline();
  const { dict } = useI18n();
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[padded && styles.pad, { paddingBottom: 48 }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, padded && styles.pad]}>{children}</View>
  );
  return (
    <SafeAreaView edges={edges} style={styles.screen}>
      {!online && (
        <View style={styles.offline} accessibilityRole="alert">
          <Ionicons name="cloud-offline-outline" size={16} color={colors.surface} />
          <Text variant="caption" style={{ color: colors.surface }}>{dict.common.offlineTitle}</Text>
        </View>
      )}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {body}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
  accessibilityHint,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
  accessibilityHint?: string;
}) {
  const palette = {
    primary: { bg: colors.primary, fg: colors.surface, border: colors.primary },
    secondary: { bg: colors.surface, fg: colors.primary, border: colors.primary },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
    danger: { bg: colors.surface, fg: colors.danger, border: colors.danger },
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={palette.fg} /> : (
        <>
          {icon && <Ionicons name={icon} size={20} color={palette.fg} />}
          <Text variant="bodyStrong" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: palette.fg, flexShrink: 1 }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Card({ children, style, onPress, accessibilityLabel }: { children: ReactNode; style?: ViewStyle; onPress?: () => void; accessibilityLabel?: string }) {
  const content = <View style={[styles.card, style]}>{children}</View>;
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
      {content}
    </Pressable>
  ) : content;
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={[styles.chip, selected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
    >
      <Text variant="small" style={{ color: selected ? colors.surface : colors.text }}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View style={styles.segment} accessibilityRole="tablist">
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => onChange(o.value)}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === o.value }}
          style={[styles.segmentItem, value === o.value && styles.segmentActive]}
        >
          <Text variant="bodyStrong" style={{ color: value === o.value ? colors.primary : colors.textMuted }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Field({ label, hint, error, ...props }: TextInputProps & { label: string; hint?: string; error?: string }) {
  const { rtl } = useI18n();
  return (
    <View style={{ gap: 6, marginBottom: space.lg }}>
      <Text variant="small" style={{ color: colors.text }}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={label}
        accessibilityHint={hint}
        {...props}
        style={[styles.input, { textAlign: rtl ? 'right' : 'left' }, error && { borderColor: colors.danger }, props.multiline && { minHeight: 110, textAlignVertical: 'top' }, props.style]}
      />
      {error ? <Text variant="caption" style={{ color: colors.danger }} accessibilityRole="alert">{error}</Text> : hint ? <Text variant="caption">{hint}</Text> : null}
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.sm }, style]}>{children}</View>;
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: space.md }} />;
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'green' | 'amber' | 'red' | 'demo' }) {
  const bg = { neutral: colors.surfaceMuted, green: colors.primarySoft, amber: '#FFF4D6', red: '#FBEAE8', demo: '#FFF3CD' }[tone];
  const fg = { neutral: colors.textMuted, green: colors.primary, amber: colors.warning, red: colors.danger, demo: '#7A5B00' }[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text variant="caption" style={{ color: fg, fontFamily: 'IBMPlexSansArabic-Medium' }}>{label}</Text>
    </View>
  );
}

export function ListRow({ title, subtitle, icon, onPress, right }: { title: string; subtitle?: string; icon?: keyof typeof Ionicons.glyphMap; onPress?: () => void; right?: ReactNode }) {
  return (
    <Pressable onPress={onPress} accessibilityRole={onPress ? 'button' : undefined} style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: colors.surfaceMuted }]}>
      {icon && <Ionicons name={icon} size={22} color={colors.primary} />}
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{title}</Text>
        {subtitle && <Text variant="small">{subtitle}</Text>}
      </View>
      {right ?? (onPress && <Ionicons name="chevron-forward" size={20} color={colors.textMuted} style={flipX()} />)}
    </Pressable>
  );
}

// ------------------------------------------------------------- state views

export function Loading() {
  const { dict } = useI18n();
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }), Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={dict.common.loading}>
      {[0, 1, 2].map((i) => <Animated.View key={i} style={[styles.skeleton, { opacity: pulse }]} />)}
    </View>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={styles.center}>
      <Ionicons name="home-outline" size={40} color={colors.border} />
      <Text variant="heading" style={{ textAlign: 'center' }}>{title}</Text>
      {body && <Text variant="small" style={{ textAlign: 'center' }}>{body}</Text>}
      {action}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { dict, err } = useI18n();
  const offline = (error as any)?.status === 0;
  return (
    <View style={styles.center} accessibilityRole="alert">
      <Ionicons name={offline ? 'cloud-offline-outline' : 'alert-circle-outline'} size={40} color={colors.textMuted} />
      <Text variant="heading">{offline ? dict.common.offlineTitle : dict.common.errorTitle}</Text>
      <Text variant="small" style={{ textAlign: 'center' }}>{offline ? dict.common.offlineBody : err((error as any)?.code)}</Text>
      {onRetry && <Button title={dict.common.retry} onPress={onRetry} variant="secondary" icon="refresh" />}
    </View>
  );
}

/** Renders loading / error / content for a React Query result. */
export function Query<T>({ q, children, empty }: { q: { data?: T; isLoading: boolean; error: unknown; refetch: () => void }; children: (data: T) => ReactNode; empty?: (data: T) => boolean }) {
  if (q.isLoading) return <Loading />;
  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={q.refetch} />;
  if (!q.data) return null;
  if (empty?.(q.data)) return null;
  return <>{children(q.data)}</>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  pad: { padding: space.lg },
  offline: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.text, paddingVertical: 6 },
  button: { minHeight: TOUCH, borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: space.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadow },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center' },
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 4 },
  segmentItem: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.surface, ...shadow },
  input: { minHeight: TOUCH, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: 16, fontFamily: 'IBMPlexSansArabic-Regular', color: colors.text, backgroundColor: colors.surface },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm, paddingHorizontal: space.sm, borderRadius: radius.md },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.md, paddingVertical: 48, paddingHorizontal: space.xl },
  skeleton: { width: '100%', height: 120, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted },
});
