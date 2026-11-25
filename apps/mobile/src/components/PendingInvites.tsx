import { type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { Invite } from '@/api/types';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Pressable } from '@/components/Pressable';
import { fonts, type Palette, size, space, text } from '@/theme';

/**
 * The signed-in user's invites, each with Decline and Accept (Home, Settings, no-ledger); nothing while there are none
 * and no failure. The failure line sits under the list: the invite it's about is gone after the refetch.
 */
export function PendingInvites({
  invites,
  busyId,
  failure,
  onAccept,
  onDecline,
  style,
}: {
  invites: Invite[];
  busyId: number | null;
  failure: string | null;
  onAccept: (invite: Invite) => void;
  onDecline: (invite: Invite) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemedStyles(makeStyles);
  if (!invites.length && !failure) return null;
  const busy = busyId !== null;
  return (
    <View style={[styles.section, style]}>
      <Text style={styles.caption}>Invites</Text>
      {invites.map((invite) => {
        const from = `${invite.owner} to ${invite.ledgerName}`;
        return (
          <Card key={invite.inviteId} padding="padded" style={styles.card}>
            <Text style={styles.text}>{`${invite.owner} invited you to ${invite.ledgerName}`}</Text>
            <View style={styles.buttons}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Decline invite from ${from}`}
                disabled={busy}
                onPress={() => onDecline(invite)}
                style={[styles.decline, busy && { opacity: 0.6 }]}
              >
                <Text style={styles.declineText}>Decline</Text>
              </Pressable>
              <Button
                variant="primary"
                size="compact"
                label="Accept"
                accessibilityLabel={`Accept invite from ${from}`}
                busy={busyId === invite.inviteId}
                disabled={busy}
                onPress={() => onAccept(invite)}
              />
            </View>
          </Card>
        );
      })}
      {failure ? (
        <Text accessibilityRole="alert" style={styles.failure}>
          {failure}
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    section: { gap: space.sm },
    caption: { ...text.caption, color: colors.muted },
    card: { gap: space.sm },
    text: { ...text.body, fontFamily: fonts.bodyMedium, color: colors.text },
    buttons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: space.sm },
    decline: { minHeight: size.iconButton, justifyContent: 'center', paddingHorizontal: space.md },
    declineText: { ...text.body, fontFamily: fonts.bodyMedium, color: colors.muted },
    failure: { ...text.label, color: colors.over },
  });
