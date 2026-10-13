import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NotionStatus } from '@/api/types';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { statusText, syncErrorText, syncReport } from '@/data/notionSync';
import type { SyncOutcome } from '@/data/useNotionSync';
import { fonts, type Palette } from '@/theme';

interface Props {
  status: NotionStatus;
  syncing: boolean;
  outcome: SyncOutcome | null;
  onSync: () => void;
}

/** The "Sync to Notion" card on Home: what's unsent, the button, and what the last press did. */
export function NotionSyncPanel({ status, syncing, outcome, onSync }: Props) {
  const styles = useThemedStyles(makeStyles);
  const report = outcome?.kind === 'result' ? syncReport(outcome.result) : null;
  const refusal = outcome?.kind === 'refused' ? syncErrorText(outcome.code) : null;

  // role="alert" covers web; VoiceOver needs an explicit announcement, once per press.
  useEffect(() => {
    if (!outcome) return;
    if (outcome.kind === 'refused') {
      AccessibilityInfo.announceForAccessibility(syncErrorText(outcome.code));
      return;
    }
    const { done, failed } = syncReport(outcome.result);
    AccessibilityInfo.announceForAccessibility([done, failed].filter(Boolean).join('. '));
  }, [outcome]);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.status}>{statusText(status)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sync to Notion"
          accessibilityState={{ disabled: syncing, busy: syncing }}
          disabled={syncing}
          onPress={onSync}
          style={[styles.button, syncing && styles.dimmed]}
        >
          <Text style={styles.buttonText}>{syncing ? 'Syncing…' : 'Sync to Notion'}</Text>
        </Pressable>
      </View>
      {report || refusal ? (
        <View accessibilityRole="alert" style={styles.result}>
          {report?.done ? <Text style={styles.done}>{report.done}</Text> : null}
          {report?.failed ? (
            <View style={styles.failedRow}>
              <Text style={styles.failed}>{report.failed}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: syncing }}
                disabled={syncing}
                onPress={onSync}
                style={[styles.retry, syncing && styles.dimmed]}
              >
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : null}
          {refusal ? <Text style={styles.failed}>{refusal}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 22,
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 10,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    status: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.muted },
    button: {
      minHeight: 44,
      paddingHorizontal: 16,
      borderRadius: 22,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dimmed: { opacity: 0.5 },
    buttonText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.onAccent },
    result: { gap: 2 },
    done: { fontFamily: fonts.body, fontSize: 14, color: colors.text },
    failedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    failed: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.danger },
    retry: { minHeight: 44, justifyContent: 'center' },
    retryText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.accent },
  });
