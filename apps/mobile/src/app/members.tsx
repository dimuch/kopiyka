import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Member } from '@/api/types';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { Icon } from '@/components/Icon';
import { LoadError } from '@/components/LoadError';
import { useMembers } from '@/data/useMembers';
import { fonts, type Palette } from '@/theme';

// Opened straight from a web link there's nothing to go back to, so fall back to Settings.
function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/settings');
}

/** The open ledger's members for its owner; a member sees only the ledger, since the list is the owner's. */
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
        {ledger.role === 'owner' ? <OwnerMembers ledgerId={ledger.ledgerId} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function OwnerMembers({ ledgerId }: { ledgerId: number }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { user } = useSession();
  const { data, error, reload } = useMembers(ledgerId);

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
        {data.members.map((member, index) => (
          <MemberRow key={member.userId} member={member} isYou={member.userId === user.userId} first={index === 0} />
        ))}
      </View>
    </>
  );
}

function MemberRow({ member, isYou, first }: { member: Member; isYou: boolean; first: boolean }) {
  const styles = useThemedStyles(makeStyles);
  const role = member.role === 'owner' ? 'Owner' : 'Member';
  return (
    <View style={[styles.row, !first && styles.divider]}>
      {/* Only the text is one element, so a button beside it stays reachable with VoiceOver on iOS. */}
      <View accessible accessibilityLabel={`${member.username}, ${role}${isYou ? ', you' : ''}`} style={styles.who}>
        <Text numberOfLines={1} style={styles.name}>
          {member.username}
        </Text>
        <Text style={styles.role}>{isYou ? `${role} · you` : role}</Text>
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
    who: { minHeight: 44, justifyContent: 'center', gap: 2 },
    name: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
    role: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  });
