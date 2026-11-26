import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { Text } from '@/components/Text';
import { type Palette, size, space } from '@/theme';

/** The real app's sign-in page, for a visitor who wants their own budget. */
const SIGN_IN_URL = 'https://kopiyka.englishplus.com.ua/login';

/** Above every demo page: it's a demo, its data lives in this page only, and the way to the real app. */
export function DemoStrip() {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.strip}>
      <Text variant="labelRegular" style={styles.text}>
        Demo: a reload clears your changes.
      </Text>
      <Link href={SIGN_IN_URL} asChild>
        <Text variant="labelSemi" color="accentText" style={styles.link}>
          Sign in
        </Text>
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
      gap: space.md,
      paddingLeft: space.xl,
      backgroundColor: colors.accentTint,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.hairline,
    },
    text: { flexShrink: 1 },
    // A 44pt touch target, as the conventions ask.
    link: { minHeight: size.iconButton, paddingHorizontal: space.xl, lineHeight: size.iconButton },
  });
