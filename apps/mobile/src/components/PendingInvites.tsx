import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import type { Invite } from '@/api/types';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { type Palette, space } from '@/theme';

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
      <Text variant="caption" color="muted">
        Invites
      </Text>
      {invites.map((invite) => {
        const from = `${invite.owner} to ${invite.ledgerName}`;
        return (
          <Card key={invite.inviteId} padding="padded" style={styles.card}>
            <Text variant="bodyMedium">{`${invite.owner} invited you to ${invite.ledgerName}`}</Text>
            <View style={styles.buttons}>
              <Button
                variant="mutedText"
                size="compact"
                label="Decline"
                accessibilityLabel={`Decline invite from ${from}`}
                disabled={busy}
                onPress={() => onDecline(invite)}
                style={[styles.decline, busy && { opacity: 0.6 }]}
              />
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
        <Text accessibilityRole="alert" variant="label" color="over">
          {failure}
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    section: { gap: space.sm },
    card: { gap: space.sm },
    buttons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: space.sm },
    decline: { paddingHorizontal: space.md },
  });
