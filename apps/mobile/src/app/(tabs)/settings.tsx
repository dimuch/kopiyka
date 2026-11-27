import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useAnnouncedError } from '@/announcedError';
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
import { useTabBarRoom } from '@/components/TabBar';
import { Text } from '@/components/Text';
import { useInvites } from '@/data/invites';
import { usePushOnce } from '@/pushOnce';
import { type Palette, radius, size, space } from '@/theme';

export default function Settings() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const barRoom = useTabBarRoom();
  const membersCard = useCardStyle('none');
  const pushOnce = usePushOnce();
  const { preference, setPreference } = useAppearance();
  const { user, ledger, ledgers, logout, openLedger } = useSession();
  const invites = useInvites();
  const [switching, setSwitching] = useState(false);
  const { error: switchError, showError, clearError } = useAnnouncedError();
  // `switching` disables the picker only after a re-render; two taps in one tick would both get here.
  const inFlight = useRef(false);

  async function switchTo(ledgerId: number) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSwitching(true);
    clearError();
    try {
      await openLedger(ledgerId);
    } catch {
      showError(SWITCH_FAILED);
    } finally {
      inFlight.current = false;
      setSwitching(false);
    }
  }

  return (
    <PlaceholderPage title="Settings">
      {/* Scrolls once invites and the Ledger picker no longer fit above the tab bar. */}
      <ScrollView
        // Ends 16pt above the floating tab bar, which also keeps Sign out above it.
        style={[styles.scroll, { marginBottom: barRoom }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Card padding="padded" style={styles.account}>
          <View style={styles.avatar}>
            <Text variant="heading" color="accentText">
              {user.username.slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={styles.accountText}>
            <Text variant="caption" color="muted">
              Signed in as
            </Text>
            <Text numberOfLines={1} variant="bodyStrong">
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
            <Text variant="caption" color="muted">
              Ledger
            </Text>
            <LedgerPicker ledgers={ledgers} selectedId={ledger.ledgerId} onSelect={switchTo} disabled={switching} />
            {switchError ? (
              <Text accessibilityRole="alert" variant="label" color="danger">
                {switchError}
              </Text>
            ) : null}
          </View>
        )}
        {/* On its own, always shown: with one ledger there's no Ledger section to put it in. */}
        <Pressable
          accessibilityRole="button"
          onPress={() => pushOnce('/members')}
          style={[membersCard, styles.members]}
        >
          <Text variant="bodyMedium">Members</Text>
          <Icon name="forward" color={colors.muted} />
        </Pressable>
        <View style={styles.section}>
          <Text variant="caption" color="muted">
            Appearance
          </Text>
          <AppearancePicker value={preference} onChange={setPreference} />
        </View>
        {/* Pins Sign out to the bottom when there's room, and keeps a gap above it when the page scrolls. */}
        <View style={styles.spacer} />
        <Button variant="danger" label="Sign out" onPress={logout} />
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
    section: { marginTop: space.xxl, gap: space.sm },
    members: {
      marginTop: space.xxl,
      minHeight: size.iconButton,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: space.sm,
      paddingHorizontal: space.md,
    },
    // Out to the screen's edges (PlaceholderPage's gutter), with the gutter inside, so the scroll view doesn't clip
    // the cards' side shadows.
    scroll: { marginHorizontal: -space.xl },
    // The same 8pt between sections as PlaceholderPage's own gap.
    content: { flexGrow: 1, gap: space.sm, paddingHorizontal: space.xl },
    spacer: { flexGrow: 1, minHeight: space.xxl },
  });
