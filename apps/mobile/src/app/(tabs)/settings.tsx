import { Pressable, StyleSheet, Text } from 'react-native';
import { useSession } from '@/auth/AuthContext';
import { PlaceholderPage } from '@/components/PlaceholderPage';
import { colors, fonts } from '@/theme';

export default function Settings() {
  const { user, logout } = useSession();
  return (
    <PlaceholderPage title="Settings">
      <Pressable accessibilityRole="button" onPress={logout} style={styles.signOut}>
        <Text style={styles.small}>Signed in as {user.username} · Sign out</Text>
      </Pressable>
    </PlaceholderPage>
  );
}

const styles = StyleSheet.create({
  signOut: { alignSelf: 'flex-start', paddingVertical: 16 },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
});
