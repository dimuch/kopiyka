import { ActivityIndicator, type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { Invite } from '@/api/types';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { Pressable } from '@/components/Pressable';
import { fonts, type Palette } from '@/theme';

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
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  if (!invites.length && !failure) return null;
  const busy = busyId !== null;
  return (
    <View style={[styles.section, style]}>
      <Text style={styles.caption}>Invites</Text>
      {invites.map((invite) => {
        const from = `${invite.owner} to ${invite.ledgerName}`;
        return (
          <View key={invite.inviteId} style={styles.card}>
            <Text style={styles.text}>{`${invite.owner} invited you to ${invite.ledgerName}`}</Text>
            <View style={styles.buttons}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Decline invite from ${from}`}
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={() => onDecline(invite)}
                style={[styles.decline, busy && { opacity: 0.6 }]}
              >
                <Text style={styles.declineText}>Decline</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Accept invite from ${from}`}
                accessibilityState={{ disabled: busy, busy: busyId === invite.inviteId }}
                disabled={busy}
                onPress={() => onAccept(invite)}
                style={[styles.accept, busy && { opacity: 0.6 }]}
              >
                {busyId === invite.inviteId && <ActivityIndicator size="small" color={colors.onAccent} />}
                <Text style={styles.acceptText}>Accept</Text>
              </Pressable>
            </View>
          </View>
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
    section: { gap: 8 },
    caption: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
    card: {
      gap: 8,
      padding: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    text: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
    buttons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8 },
    decline: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
    declineText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.muted },
    accept: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 22,
      paddingHorizontal: 18,
      backgroundColor: colors.accent,
    },
    acceptText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.onAccent },
    failure: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.over },
  });
