import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useAuth } from '@/auth/AuthContext';
import { LoadError } from '@/components/LoadError';
import { PendingInvites } from '@/components/PendingInvites';
import { useInvites } from '@/data/invites';
import { fonts, outlinedDangerButton, outlinedDangerText, type Palette } from '@/theme';

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
        <View style={{ gap: 8 }}>
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
        <Pressable accessibilityRole="button" onPress={reload} style={styles.check}>
          <Text style={styles.checkText}>Check for invites</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={logout} style={styles.signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    body: {
      flexGrow: 1,
      padding: 24,
      justifyContent: 'center',
      gap: 32,
      width: '100%',
      maxWidth: 420,
      alignSelf: 'center',
    },
    title: { fontFamily: fonts.display, fontSize: 28, color: colors.text, letterSpacing: -0.4 },
    text: { fontFamily: fonts.body, fontSize: 15, color: colors.muted },
    check: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', marginLeft: -8, paddingHorizontal: 8 },
    checkText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.accent },
    signOut: outlinedDangerButton(colors),
    signOutText: outlinedDangerText(colors),
  });
