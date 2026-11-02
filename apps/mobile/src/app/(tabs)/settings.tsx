import { useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppearance, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { AppearancePicker } from '@/components/AppearancePicker';
import { LedgerPicker } from '@/components/LedgerPicker';
import { PlaceholderPage } from '@/components/PlaceholderPage';
import { fonts, type Palette } from '@/theme';

export default function Settings() {
  const styles = useThemedStyles(makeStyles);
  const { preference, setPreference } = useAppearance();
  const { user, ledger, ledgers, logout, openLedger } = useSession();
  const [switching, setSwitching] = useState(false);
  const [switchFailed, setSwitchFailed] = useState(false);
  // `switching` disables the picker only after a re-render; two taps in one tick would both get here.
  const inFlight = useRef(false);

  async function switchTo(ledgerId: number) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSwitching(true);
    setSwitchFailed(false);
    try {
      await openLedger(ledgerId);
    } catch {
      setSwitchFailed(true);
      // role="alert" covers web; VoiceOver needs an explicit announcement.
      AccessibilityInfo.announceForAccessibility(SWITCH_FAILED);
    } finally {
      inFlight.current = false;
      setSwitching(false);
    }
  }

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
      {ledgers.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.caption}>Ledger</Text>
          <LedgerPicker ledgers={ledgers} selectedId={ledger.ledgerId} onSelect={switchTo} disabled={switching} />
          {switchFailed && (
            <Text accessibilityRole="alert" style={styles.error}>
              {SWITCH_FAILED}
            </Text>
          )}
        </View>
      )}
      <View style={styles.section}>
        <Text style={styles.caption}>Appearance</Text>
        <AppearancePicker value={preference} onChange={setPreference} />
      </View>
      <Pressable accessibilityRole="button" onPress={logout} style={styles.signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </PlaceholderPage>
  );
}

const SWITCH_FAILED = 'Couldn’t switch. Check your connection and try again.';

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
    section: { marginTop: 24, gap: 8 },
    error: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.over },
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
