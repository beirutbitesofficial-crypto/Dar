import { BRAND } from '@dar/shared';
import { I18nManager, StyleSheet } from 'react-native';

export const colors = BRAND.colors;
export const radius = BRAND.radius;
export const space = BRAND.spacing;
export const fonts = BRAND.fonts;

/** Minimum touch target (Apple HIG 44pt, Material 48dp). */
export const TOUCH = 48;

export const type = StyleSheet.create({
  display: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 38, color: colors.text, textAlign: 'auto' },
  title: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 32, color: colors.text },
  heading: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 28, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 26, color: colors.text },
  bodyStrong: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 26, color: colors.text },
  small: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textMuted },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textMuted },
  price: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 30, color: colors.primary, fontVariant: ['tabular-nums'] },
});

/** Flip directional glyphs (chevrons, arrows) in RTL. */
export const flipX = () => (I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : {});

export const shadow = {
  shadowColor: '#22252A',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};
