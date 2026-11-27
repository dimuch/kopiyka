import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/api/apiError';
import type { Ledger, Member, PendingInvite } from '@/api/types';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { LoadError } from '@/components/LoadError';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { normalizeLabel } from '@/data/ledgerLabel';
import { inviteMember, removeMember, revokeInvite, setLedgerLabel } from '@/data/members';
import { useMembers } from '@/data/useMembers';
import { type Palette, radius, size, space, text } from '@/theme';

// Opened straight from a web link there's nothing to go back to, so fall back to Settings.
function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/settings');
}

/**
 * Everyone sets their own label for the open ledger at the top. Below, its owner sees the members, can remove them and
 * invite people; a member sees only Leave.
 */
export default function MembersScreen() {
  const styles = useThemedStyles(makeStyles);
  const { ledger } = useSession();
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader variant="page" backLabel="Back" onBack={goBack} />
      {/* One tap on Save or Invite works on iPhone with the keyboard up. */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={{ gap: space.xxs }}>
          <Text accessibilityRole="header" variant="display">
            Members
          </Text>
          {/* The user's own label, else the owner tells "Home"s apart, as in the Settings picker. */}
          <Text variant="labelRegular" color="muted">
            {ledger.label ?? `${ledger.owner}’s ${ledger.name}`}
          </Text>
        </View>
        {/* Keyed by ledger, so the field resets if the ledger-gone handler swaps it. */}
        <LabelForm key={ledger.ledgerId} ledger={ledger} />
        {ledger.role === 'owner' ? <OwnerMembers ledgerId={ledger.ledgerId} /> : <MemberLeave ledger={ledger} />}
      </ScrollView>
    </SafeAreaView>
  );
}

/** The user's own label for this ledger: only they see it, in place of "Home". Empty brings back the usual name. */
function LabelForm({ ledger }: { ledger: Ledger }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { openLedger } = useSession();
  const [draft, setDraft] = useState(ledger.label ?? '');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // `busy` disables the button only after a re-render; two taps in one tick would both get here.
  const inFlight = useRef(false);
  const unchanged = draft.trim() === (ledger.label ?? '');

  function fail(message: string) {
    // role="alert" covers web; VoiceOver needs an explicit announcement.
    setFailure(message);
    AccessibilityInfo.announceForAccessibility(message);
  }

  async function save() {
    if (inFlight.current) return;
    const label = normalizeLabel(draft);
    if (label === null) return fail('A label can have up to 40 characters.');
    inFlight.current = true;
    setBusy(true);
    setFailure(null);
    try {
      try {
        await setLedgerLabel(ledger.ledgerId, label);
      } catch (err) {
        // Removed meanwhile: the ledger-gone handler is already moving them, as after Leave.
        if (err instanceof ApiError && err.code === 'ledger_not_found') return router.dismissTo('/');
        return fail('Couldn’t save. Check your connection and try again.');
      }
      setDraft(label);
      // Reloads the ledgers, so the picker, Home and this caption show it; the open ledger stays open.
      try {
        await openLedger(ledger.ledgerId);
        AccessibilityInfo.announceForAccessibility('Label saved.');
      } catch {
        fail('Saved, but couldn’t refresh. Reopen the app to see it everywhere.');
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={styles.section}>
      <Text variant="label" color="muted">
        Your label
      </Text>
      <TextField
        accessibilityLabel="Your label"
        value={draft}
        onChangeText={setDraft}
        placeholder={ledger.name}
        placeholderTextColor={colors.muted}
        returnKeyType="done"
        onSubmitEditing={() => !unchanged && save()}
        editable={!busy}
        style={styles.input}
      />
      <Text variant="labelRegular" color="muted">
        Only you see it. Leave it empty for the usual name.
      </Text>
      {failure ? (
        <Text accessibilityRole="alert" variant="label" color="danger">
          {failure}
        </Text>
      ) : null}
      <Button variant="primary" label="Save" busy={busy} disabled={unchanged} onPress={save} />
    </View>
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
      const message = notHere
        ? `${member.username} isn’t in this ledger any more.`
        : 'Couldn’t remove. Check your connection and try again.';
      setGone(notHere);
      // role="alert" covers web; VoiceOver needs an explicit announcement.
      setFailure(message);
      AccessibilityInfo.announceForAccessibility(message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (!data) {
    return error ? (
      <LoadError message="Couldn’t load the members. Check your connection and try again." onRetry={reload} />
    ) : (
      <ActivityIndicator color={colors.accent} style={{ marginTop: space.xxl }} />
    );
  }
  return (
    <>
      {error && <LoadError message="Couldn’t refresh. Check your connection and try again." onRetry={reload} />}
      {/* Never empty: the list always has the owner, who is the viewer. */}
      <View style={styles.list}>
        {data.members.map((member) => {
          const isYou = member.userId === user.userId;
          return (
            <Card key={member.userId} padding="none" style={styles.row}>
              <View style={styles.line}>
                <MemberName member={member} isYou={isYou} />
                {/* The owner can't remove themselves: the owner is the viewer. */}
                {!isYou && (
                  <Button
                    variant="dangerText"
                    label="Remove"
                    accessibilityLabel={`Remove ${member.username}`}
                    disabled={busy}
                    onPress={() => showPanel(member)}
                  />
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
                  onDismiss={() => showPanel(null)}
                />
              )}
            </Card>
          );
        })}
      </View>
      <PendingList ledgerId={ledgerId} invites={data.invites} onChange={reload} />
      <InviteForm ledgerId={ledgerId} onInvited={reload} />
    </>
  );
}

/**
 * The ledger's live invites, each with a one-tap Revoke (inviting again undoes it); nothing while there are none and
 * no failure to show.
 */
function PendingList({
  ledgerId,
  invites,
  onChange,
}: {
  ledgerId: number;
  invites: PendingInvite[];
  onChange: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // `busy` disables the buttons only after a re-render; two taps in one tick would both get here.
  const inFlight = useRef(false);

  async function revoke(invite: PendingInvite) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailure(null);
    try {
      await revokeInvite(ledgerId, invite.inviteId);
      onChange();
    } catch (err) {
      // Expired, or answered meanwhile: the row is stale, so the list reloads under the message.
      const gone = err instanceof ApiError && err.code === 'not_found';
      const message = gone
        ? `${invite.username}’s invite has already expired or been answered.`
        : 'Couldn’t revoke. Check your connection and try again.';
      // role="alert" covers web; VoiceOver needs an explicit announcement.
      setFailure(message);
      AccessibilityInfo.announceForAccessibility(message);
      if (gone) onChange();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (!invites.length && !failure) return null;
  return (
    <View style={styles.section}>
      <Text variant="labelRegular" color="muted">
        Invited
      </Text>
      {invites.length
        ? invites.map((invite) => (
            <Card key={invite.inviteId} padding="none" style={styles.row}>
              <View style={styles.line}>
                <View style={styles.who}>
                  <Text numberOfLines={1} variant="bodyMedium">
                    {invite.username}
                  </Text>
                </View>
                <Button
                  variant="dangerText"
                  label="Revoke"
                  accessibilityLabel={`Revoke invite to ${invite.username}`}
                  disabled={busy}
                  onPress={() => revoke(invite)}
                />
              </View>
            </Card>
          ))
        : null}
      {failure ? (
        <Text accessibilityRole="alert" variant="label" color="danger">
          {failure}
        </Text>
      ) : null}
    </View>
  );
}

function InviteForm({ ledgerId, onInvited }: { ledgerId: number; onInvited: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // `busy` disables the button only after a re-render; two taps in one tick would both get here.
  const inFlight = useRef(false);
  const name = username.trim();

  async function invite() {
    if (inFlight.current || !name) return;
    inFlight.current = true;
    setBusy(true);
    setFailure(null);
    try {
      const invited = await inviteMember(ledgerId, name);
      setUsername('');
      AccessibilityInfo.announceForAccessibility(`Invited ${invited.username}.`);
      onInvited();
    } catch (err) {
      // One answer for an unknown user, a member and someone already invited: the API doesn't say which.
      const message =
        err instanceof ApiError && err.code === 'cannot_invite'
          ? `Can’t invite ${name}. Check the spelling; they may already be in this ledger or invited to it.`
          : 'Couldn’t invite. Check your connection and try again.';
      // role="alert" covers web; VoiceOver needs an explicit announcement.
      setFailure(message);
      AccessibilityInfo.announceForAccessibility(message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={styles.section}>
      <Text variant="label" color="muted">
        Invite by username
      </Text>
      <TextField
        accessibilityLabel="Username to invite"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={64}
        returnKeyType="send"
        onSubmitEditing={invite}
        editable={!busy}
        style={styles.input}
      />
      <Text variant="labelRegular" color="muted">
        They’ll see it in the app for an hour.
      </Text>
      {failure ? (
        <Text accessibilityRole="alert" variant="label" color="danger">
          {failure}
        </Text>
      ) : null}
      <Button variant="primary" label="Invite" busy={busy} disabled={!name} onPress={invite} />
    </View>
  );
}

function MemberName({ member, isYou }: { member: Member; isYou: boolean }) {
  const styles = useThemedStyles(makeStyles);
  const role = member.role === 'owner' ? 'Owner' : 'Member';
  return (
    // Only the text is one element, so the Remove button beside it stays reachable with VoiceOver on iOS.
    <View accessible accessibilityLabel={`${member.username}, ${role}${isYou ? ', you' : ''}`} style={styles.who}>
      <Text numberOfLines={1} variant="bodyMedium">
        {member.username}
      </Text>
      <Text variant="labelRegular" color="muted">
        {isYou ? `${role} · you` : role}
      </Text>
    </View>
  );
}

/** A member's view: the list is the owner's, so only Leave. */
function MemberLeave({ ledger }: { ledger: Ledger }) {
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
        const message = 'Couldn’t leave. Check your connection and try again.';
        setFailure(message);
        AccessibilityInfo.announceForAccessibility(message);
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
      onDismiss={() => showPanel(false)}
    />
  ) : (
    <Button variant="danger" label="Leave ledger" onPress={() => showPanel(true)} />
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
  onDismiss,
}: {
  question: string;
  detail?: string;
  action: string;
  busy: boolean;
  failure: string | null;
  gone: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.panel}>
      <Text variant="bodyStrong">{question}</Text>
      {detail ? <Text variant="labelRegular">{detail}</Text> : null}
      {failure ? (
        <Text accessibilityRole="alert" variant="label" color="danger">
          {failure}
        </Text>
      ) : null}
      <View style={styles.panelButtons}>
        <Button variant="mutedText" label={gone ? 'Close' : 'Back'} disabled={busy} onPress={onDismiss} />
        {!gone && <Button variant="danger" label={action} busy={busy} onPress={onConfirm} />}
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.xl, paddingTop: space.xl },
    // Out to the screen's edges, with the gutter inside, so the scroll view doesn't clip the cards' side shadows.
    scroll: { marginHorizontal: -space.xl },
    content: { gap: space.lg, paddingTop: space.sm, paddingBottom: space.huge, paddingHorizontal: space.xl },
    row: { paddingVertical: space.sm, paddingHorizontal: space.md, gap: space.sm },
    list: { gap: space.sm },
    line: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    who: { flex: 1, minHeight: size.iconButton, justifyContent: 'center', gap: space.xxs },
    panel: {
      gap: space.sm,
      padding: space.lg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
    },
    panelButtons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: space.sm },
    section: { gap: space.sm },
    input: {
      ...text.input,
      height: size.control,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
      color: colors.text,
      paddingHorizontal: space.lg,
    },
  });
