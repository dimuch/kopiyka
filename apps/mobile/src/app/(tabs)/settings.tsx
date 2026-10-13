import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppearance, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { AppearancePicker } from '@/components/AppearancePicker';
import { PlaceholderPage } from '@/components/PlaceholderPage';
import { fonts, type Palette } from '@/theme';

export default function Settings() {
  const styles = useThemedStyles(makeStyles);
  const { preference, setPreference } = useAppearance();
  const { user, logout } = useSession();
  return (
    <PlaceholderPage title="Settings">
      <View style={styles.account}>
        <View style={styles.avatar}>
          <Text style={styles.initial}>{user.username.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.caption}>Signed in as</Text>
          <Text numberOfLines={1} style={styles.username}>
            {user.username}
          </Text>
        </View>
      </View>
      <View style={styles.appearance}>
        <Text style={styles.caption}>Appearance</Text>
        <AppearancePicker value={preference} onChange={setPreference} />
      </View>
      <Pressable accessibilityRole="button" onPress={logout} style={styles.signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </PlaceholderPage>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    account: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 22,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.accentTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initial: { fontFamily: fonts.display, fontSize: 17, color: colors.accent },
    appearance: { marginTop: 24, gap: 8 },
    caption: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
    username: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.text },
    // Shaped like the login button, outlined so it doesn't read as the screen's main action;
    // the auto top margin pins it to the bottom of the page, above the tab bar.
    signOut: {
      marginTop: 'auto',
      marginBottom: 20,
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
