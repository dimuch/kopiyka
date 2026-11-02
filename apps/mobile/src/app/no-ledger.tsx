import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { useAuth } from '@/auth/AuthContext';
import { fonts, type Palette } from '@/theme';

/** Shown to a signed-in user who is in no ledger: nothing to open, so all they can do is sign out. */
export default function NoLedger() {
  const styles = useThemedStyles(makeStyles);
  const { state, logout } = useAuth();
  if (state.status !== 'noLedger') return null;
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={styles.title}>
            You’re not in any ledger
          </Text>
          <Text style={styles.text}>Signed in as {state.user.username}.</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={logout} style={styles.signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    body: {
      flex: 1,
      padding: 24,
      justifyContent: 'center',
      gap: 32,
      width: '100%',
      maxWidth: 420,
      alignSelf: 'center',
    },
    title: { fontFamily: fonts.display, fontSize: 28, color: colors.text, letterSpacing: -0.4 },
    text: { fontFamily: fonts.body, fontSize: 15, color: colors.muted },
    // The same outlined Sign out as Settings.
    signOut: {
      height: 48,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    signOutText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.danger },
  });
