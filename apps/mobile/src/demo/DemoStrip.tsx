import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { fonts, type Palette } from '@/theme';

/** The real app's sign-in page, for a visitor who wants their own budget. */
const SIGN_IN_URL = 'https://kopiyka.englishplus.com.ua/login';

/** Above every demo page: it's a demo, its data lives in this page only, and the way to the real app. */
export function DemoStrip() {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.strip}>
      <Text style={styles.text}>Demo: a reload clears your changes.</Text>
      <Link href={SIGN_IN_URL} style={styles.link}>
        Sign in
      </Link>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    strip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingLeft: 20,
      backgroundColor: colors.accentTint,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    text: { flexShrink: 1, fontFamily: fonts.body, fontSize: 13, color: colors.text },
    // A 44pt touch target, as the conventions ask.
    link: {
      minHeight: 44,
      paddingHorizontal: 20,
      lineHeight: 44,
      fontFamily: fonts.bodySemi,
      fontSize: 13,
      color: colors.accent,
    },
  });
