import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import type { CategoryWithTotals } from '@/api/types';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { LoadError } from '@/components/LoadError';
import { deleteCategory, restoreCategory } from '@/data/categories';
import { deleteWarning, deletedMessage } from '@/data/categoryDelete';
import { setPendingUndo } from '@/data/undo';
import { useCategoryTotals } from '@/data/useCategoryTotals';
import { parseIdParam } from '@/linkParams';
import { fonts, type Palette } from '@/theme';

// Opened straight from a web link there's nothing to go back to, so fall back to Home.
function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function DeleteCategoryScreen() {
  const styles = useThemedStyles(makeStyles);
  const params = useLocalSearchParams<{ categoryId?: string | string[] }>();
  const categoryId = parseIdParam(params.categoryId);
  // A delete in flight navigates when it ends, so the user can't leave meanwhile.
  const [busy, setBusy] = useState(false);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={leave} style={styles.cancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>Delete category</Text>
        <View style={{ width: 52 }} />
      </View>

      {categoryId === null ? (
        <LoadError message="That link isn’t valid." />
      ) : (
        <CategoryLoader categoryId={categoryId} busy={busy} setBusy={setBusy} />
      )}
    </SafeAreaView>
  );
}

/** Loads what deleting would remove; mounted only for a well-formed link, so a bad one fetches nothing. */
function CategoryLoader({ categoryId, ...deleting }: { categoryId: number } & Deleting) {
  const colors = useColors();
  const { ledger } = useSession();
  const totals = useCategoryTotals(ledger.ledgerId, categoryId);

  if (totals.status === 'loading') return <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />;
  if (totals.status === 'error') {
    // Retrying can't bring a deleted category back.
    return totals.error instanceof ApiError && totals.error.code === 'not_found' ? (
      <LoadError message="This category was deleted." />
    ) : (
      <LoadError message="Couldn’t load this category. Check your connection and try again." onRetry={totals.reload} />
    );
  }
  return <Confirm category={totals.category} ledgerId={ledger.ledgerId} {...deleting} />;
}

interface Deleting {
  busy: boolean;
  setBusy: (busy: boolean) => void;
}

function Confirm({ category, ledgerId, busy, setBusy }: { category: CategoryWithTotals; ledgerId: number } & Deleting) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const warning = deleteWarning(category);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const { categoryId, displayName, expenseCount } = category;
    try {
      await deleteCategory(ledgerId, categoryId);
      // The bar uses the confirmed count; Home takes the offer when it gains focus.
      setPendingUndo({
        message: deletedMessage(displayName, expenseCount),
        restore: () => restoreCategory(ledgerId, categoryId),
      });
      router.dismissTo('/');
    } catch (err) {
      const text =
        err instanceof ApiError && err.code === 'not_found'
          ? 'This category was already deleted.'
          : 'Couldn’t delete. Check your connection and try again.';
      // The alert role covers web; VoiceOver needs an explicit announcement.
      setError(text);
      AccessibilityInfo.announceForAccessibility(text);
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text accessibilityRole="header" style={styles.question}>
        {warning.title}
      </Text>
      <Text style={styles.warning}>{warning.body}</Text>

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        // While deleting the only child is a spinner, so the name has to be given here.
        accessibilityLabel={warning.action}
        accessibilityState={{ busy }}
        disabled={busy}
        onPress={remove}
        style={[styles.destructive, busy && { opacity: 0.6 }]}
      >
        {busy ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <Text style={styles.destructiveText}>{warning.action}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, paddingTop: 8 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    cancel: { height: 44, justifyContent: 'center' },
    cancelText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.muted },
    title: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
    body: { gap: 16, paddingTop: 16, paddingBottom: 40 },
    question: { fontFamily: fonts.display, fontSize: 24, color: colors.text },
    warning: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.text },
    error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.over },
    destructive: {
      minHeight: 56,
      borderRadius: 18,
      paddingHorizontal: 16,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    destructiveText: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.onAccent, textAlign: 'center' },
  });
