import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/Button';
import { LoadError } from '@/components/LoadError';
import { PendingInvites } from '@/components/PendingInvites';
import { useInvites } from '@/data/invites';
import { type Palette, space, text } from '@/theme';

/** Shown to a signed-in user who is in no ledger: they can accept an invite or sign out. */
export default function NoLedger() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { state, logout } = useAuth();
  const { invites, error, reload, busyId, failure, accept, decline } = useInvites();
  // Someone waiting here never changes screens, so there's also a button to check again.
  useFocusEffect(reload);
  if (state.status !== 'noLedger') return null;
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={{ gap: space.sm }}>
          <Text accessibilityRole="header" style={styles.title}>
            You’re not in any ledger
          </Text>
          <Text style={styles.text}>Signed in as {state.user.username}.</Text>
        </View>
        {/* The error sits beside the list, not in its place: a failed refetch keeps it, and a failed Accept's line. */}
        {error && (
          <LoadError message="Couldn’t check for invites. Check your connection and try again." onRetry={reload} />
        )}
        {invites === null ? (
          !error && <ActivityIndicator color={colors.accent} />
        ) : (
          <PendingInvites invites={invites} busyId={busyId} failure={failure} onAccept={accept} onDecline={decline} />
        )}
        <Button variant="accentText" size="compact" label="Check for invites" onPress={reload} style={styles.check} />
        <Button variant="outlinedDanger" size="medium" label="Sign out" onPress={logout} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    body: {
      flexGrow: 1,
      padding: space.xxl,
      justifyContent: 'center',
      gap: space.xxxl,
      width: '100%',
      maxWidth: 420,
      alignSelf: 'center',
    },
    title: { ...text.display, color: colors.text },
    text: { ...text.body, color: colors.muted },
    check: { alignSelf: 'flex-start', marginLeft: -space.sm, paddingHorizontal: space.sm },
  });
