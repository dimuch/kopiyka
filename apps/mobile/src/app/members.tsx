import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import type { Ledger, Member } from '@/api/types';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { Icon } from '@/components/Icon';
import { LoadError } from '@/components/LoadError';
import { removeMember } from '@/data/members';
import { useMembers } from '@/data/useMembers';
import { dangerText, fonts, type Palette } from '@/theme';

// Opened straight from a web link there's nothing to go back to, so fall back to Settings.
function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/settings');
}

/** The open ledger's members for its owner, who can remove them; a member sees only the ledger and Leave. */
export default function MembersScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { ledger } = useSession();
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={goBack} style={styles.back}>
          <Icon name="back" color={colors.muted} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ gap: 2 }}>
          <Text accessibilityRole="header" style={styles.title}>
            Members
          </Text>
          {/* Every ledger is named "Home", so the owner tells them apart, as in the Settings picker. */}
          <Text style={styles.caption}>{`${ledger.owner}’s ${ledger.name}`}</Text>
        </View>
        {ledger.role === 'owner' ? <OwnerMembers ledgerId={ledger.ledgerId} /> : <MemberLeave ledger={ledger} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function OwnerMembers({ ledgerId }: { ledgerId: number }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { user } = useSession();
  const { data, error, reload } = useMembers(ledgerId);
  // The member whose Remove was tapped once; nothing is sent until the panel's Remove.
  const [confirming, setConfirming] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // They had already left: trying again can't help, so the panel offers only Close.
  const [gone, setGone] = useState(false);
  // `busy` disables the buttons only after a re-render; two taps in one tick would both get here.
  const inFlight = useRef(false);

  // Moving the panel or closing it clears its failure line, so it never shows under another member. A gone member
  // stays listed until then, so the message can be read; leaving the panel reloads the list without them.
  function showPanel(member: Member | null) {
    if (gone) reload();
    setConfirming(member);
    setFailure(null);
    setGone(false);
  }

  async function remove(member: Member) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailure(null);
    try {
      await removeMember(ledgerId, member.userId);
      setConfirming(null);
      reload();
    } catch (err) {
      const notHere = err instanceof ApiError && err.code === 'not_found';
      const text = notHere
        ? `${member.username} isn’t in this ledger any more.`
        : 'Couldn’t remove. Check your connection and try again.';
      setGone(notHere);
      // role="alert" covers web; VoiceOver needs an explicit announcement.
      setFailure(text);
      AccessibilityInfo.announceForAccessibility(text);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (!data) {
    return error ? (
      <LoadError message="Couldn’t load the members. Check your connection and try again." onRetry={reload} />
    ) : (
      <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
    );
  }
  return (
    <>
      {error && <LoadError message="Couldn’t refresh. Check your connection and try again." onRetry={reload} />}
      {/* Never empty: the list always has the owner, who is the viewer. */}
      <View style={styles.list}>
        {data.members.map((member, index) => {
          const isYou = member.userId === user.userId;
          return (
            <View key={member.userId} style={[styles.row, index > 0 && styles.divider]}>
              <View style={styles.line}>
                <MemberName member={member} isYou={isYou} />
                {/* The owner can't remove themselves: the owner is the viewer. */}
                {!isYou && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${member.username}`}
                    disabled={busy}
                    onPress={() => showPanel(member)}
                    style={styles.remove}
                  >
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                )}
              </View>
              {confirming?.userId === member.userId && (
                <ConfirmPanel
                  question={`Remove ${member.username}?`}
                  action="Remove"
                  busy={busy}
                  failure={failure}
                  gone={gone}
                  onConfirm={() => remove(member)}
                  onCancel={() => showPanel(null)}
                />
              )}
            </View>
          );
        })}
      </View>
    </>
  );
}

function MemberName({ member, isYou }: { member: Member; isYou: boolean }) {
  const styles = useThemedStyles(makeStyles);
  const role = member.role === 'owner' ? 'Owner' : 'Member';
  return (
    // Only the text is one element, so the Remove button beside it stays reachable with VoiceOver on iOS.
    <View accessible accessibilityLabel={`${member.username}, ${role}${isYou ? ', you' : ''}`} style={styles.who}>
      <Text numberOfLines={1} style={styles.name}>
        {member.username}
      </Text>
      <Text style={styles.role}>{isYou ? `${role} · you` : role}</Text>
    </View>
  );
}

/** A member's view: the list is the owner's, so only Leave. */
function MemberLeave({ ledger }: { ledger: Ledger }) {
  const styles = useThemedStyles(makeStyles);
  const { user } = useSession();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // `busy` disables the buttons only after a re-render; two taps in one tick would both get here.
  const inFlight = useRef(false);

  function showPanel(show: boolean) {
    setConfirming(show);
    setFailure(null);
  }

  async function leave() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailure(null);
    try {
      await removeMember(ledger.ledgerId, user.userId);
    } catch (err) {
      // Removed by the owner meanwhile: they're out either way, and the ledger-gone handler is already moving them.
      if (!(err instanceof ApiError && err.code === 'ledger_not_found')) {
        const text = 'Couldn’t leave. Check your connection and try again.';
        setFailure(text);
        AccessibilityInfo.announceForAccessibility(text);
        inFlight.current = false;
        setBusy(false);
        return;
      }
    }
    // Still busy: Home's reload gets ledger_not_found, and the handler opens another ledger or no-ledger.
    router.dismissTo('/');
  }

  return confirming ? (
    <ConfirmPanel
      question={`Leave ${ledger.owner}’s ${ledger.name}?`}
      detail="You’ll lose access to its budget and expenses."
      action="Leave"
      busy={busy}
      failure={failure}
      gone={false}
      onConfirm={leave}
      onCancel={() => showPanel(false)}
    />
  ) : (
    <Pressable accessibilityRole="button" onPress={() => showPanel(true)} style={styles.leave}>
      <Text style={styles.leaveText}>Leave ledger</Text>
    </Pressable>
  );
}

/** The second tap for Remove and Leave: there's no Undo, and browsers can block confirm() (brief 043). */
function ConfirmPanel({
  question,
  detail,
  action,
  busy,
  failure,
  gone,
  onConfirm,
  onCancel,
}: {
  question: string;
  detail?: string;
  action: string;
  busy: boolean;
  failure: string | null;
  gone: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.panel}>
      <Text style={styles.question}>{question}</Text>
      {detail && <Text style={styles.detail}>{detail}</Text>}
      {failure && (
        <Text accessibilityRole="alert" style={styles.failure}>
          {failure}
        </Text>
      )}
      <View style={styles.panelButtons}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={onCancel} style={styles.cancel}>
          <Text style={styles.cancelText}>{gone ? 'Close' : 'Cancel'}</Text>
        </Pressable>
        {!gone && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action}
            accessibilityState={{ busy }}
            disabled={busy}
            onPress={onConfirm}
            style={[styles.confirm, busy && { opacity: 0.6 }]}
          >
            {busy && <ActivityIndicator size="small" color={colors.onAccent} />}
            <Text style={styles.confirmText}>{action}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, paddingTop: 20 },
    header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 6 },
    back: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: -8, paddingHorizontal: 8 },
    backText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.muted },
    content: { gap: 16, paddingTop: 8, paddingBottom: 40 },
    title: { fontFamily: fonts.display, fontSize: 28, color: colors.text, letterSpacing: -0.3 },
    caption: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
    list: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 18 },
    row: { paddingVertical: 10, paddingHorizontal: 16, gap: 10 },
    divider: { borderTopWidth: 1, borderTopColor: colors.border },
    line: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    who: { flex: 1, minHeight: 44, justifyContent: 'center', gap: 2 },
    name: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
    role: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
    remove: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 4 },
    removeText: dangerText(colors),
    // Outlined like Settings' Sign out, so it doesn't read as the screen's main action.
    leave: {
      height: 48,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    leaveText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.danger },
    panel: {
      gap: 8,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceRaised,
    },
    question: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
    detail: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.text },
    failure: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.over },
    panelButtons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8 },
    cancel: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
    cancelText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.muted },
    confirm: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 22,
      paddingHorizontal: 18,
      backgroundColor: colors.danger,
    },
    confirmText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.onAccent },
  });
