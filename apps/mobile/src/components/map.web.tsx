// Web preview fallback: react-native-maps is native-only. The app ships to iOS/Android;
// the web build exists for previews and visual checks, so maps render as a neutral panel.
import type { ReactNode } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '@/lib/theme';

export function MapView({ style, children: _children }: { style?: StyleProp<ViewStyle>; children?: ReactNode; [k: string]: unknown }) {
  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted }, style]}>
      <Text style={{ color: colors.textMuted }}>🗺️</Text>
    </View>
  );
}

export function Marker(_props: Record<string, unknown>) {
  return null;
}
