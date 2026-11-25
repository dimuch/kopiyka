import { useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppearance, useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { AppearancePicker } from '@/components/AppearancePicker';
import { Button } from '@/components/Button';
import { Card, useCardStyle } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { LedgerPicker } from '@/components/LedgerPicker';
import { PendingInvites } from '@/components/PendingInvites';
import { PlaceholderPage } from '@/components/PlaceholderPage';
import { Pressable } from '@/components/Pressable';
import { useInvites } from '@/data/invites';
import { usePushOnce } from '@/pushOnce';
import { fonts, type Palette, radius, size, space, text } from '@/theme';

export default function Settings() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const membersCard = useCardStyle('none');
  const pushOnce = usePushOnce();
  const { preference, setPreference } = useAppearance();
  const { user, ledger, ledgers, logout, openLedger } = useSession();
  const invites = useInvites();
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
      {/* Scrolls once invites and the Ledger picker no longer fit above the tab bar. */}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card padding="padded" style={styles.account}>
          <View style={styles.avatar}>
            <Text style={styles.initial}>{user.username.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={styles.accountText}>
            <Text style={styles.caption}>Signed in as</Text>
            <Text numberOfLines={1} style={styles.username}>
              {user.username}
            </Text>
          </View>
        </Card>
        {/* Under the account card, so the tab's invite badge leads straight to them. */}
        <PendingInvites
          invites={invites.invites ?? []}
          busyId={invites.busyId}
          failure={invites.failure}
          onAccept={invites.accept}
          onDecline={invites.decline}
          style={styles.section}
        />
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
        {/* On its own, always shown: with one ledger there's no Ledger section to put it in. */}
        <Pressable
          accessibilityRole="button"
          onPress={() => pushOnce('/members')}
          style={[membersCard, styles.members]}
        >
          <Text style={styles.membersText}>Members</Text>
          <Icon name="forward" color={colors.muted} />
        </Pressable>
        <View style={styles.section}>
          <Text style={styles.caption}>Appearance</Text>
          <AppearancePicker value={preference} onChange={setPreference} />
        </View>
        {/* Pins Sign out to the bottom when there's room, and keeps a gap above it when the page scrolls. */}
        <View style={styles.spacer} />
        <Button variant="outlinedDanger" size="medium" label="Sign out" onPress={logout} style={styles.signOut} />
      </ScrollView>
    </PlaceholderPage>
  );
}

const SWITCH_FAILED = 'Couldn’t switch. Check your connection and try again.';

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    account: {
      marginTop: space.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
    },
    accountText: { flex: 1, gap: space.xxs },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      backgroundColor: colors.accentTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initial: { ...text.heading, fontFamily: fonts.display, color: colors.accent },
    section: { marginTop: space.xxl, gap: space.sm },
    members: {
      marginTop: space.xxl,
      minHeight: size.iconButton,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: space.sm,
      paddingLeft: space.lg,
      paddingRight: space.md,
    },
    membersText: { ...text.body, fontFamily: fonts.bodyMedium, color: colors.text },
    error: { ...text.label, color: colors.over },
    caption: { ...text.caption, color: colors.muted },
    username: { ...text.bodyStrong, color: colors.text },
    // The same 8pt between sections as PlaceholderPage's own gap.
    content: { flexGrow: 1, gap: space.sm },
    spacer: { flexGrow: 1, minHeight: space.xxl },
    signOut: { marginBottom: space.xl },
  });
