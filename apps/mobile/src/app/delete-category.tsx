import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import type { CategoryWithTotals } from '@/api/types';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { LoadError } from '@/components/LoadError';
import { deleteWarning } from '@/data/categoryDelete';
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

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={leave} style={styles.cancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>Delete category</Text>
        <View style={{ width: 52 }} />
      </View>

      {categoryId === null ? (
        <LoadError message="That link isn’t valid." />
      ) : (
        <CategoryLoader categoryId={categoryId} />
      )}
    </SafeAreaView>
  );
}

/** Loads what deleting would remove; mounted only for a well-formed link, so a bad one fetches nothing. */
function CategoryLoader({ categoryId }: { categoryId: number }) {
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
  return <Confirm category={totals.category} />;
}

function Confirm({ category }: { category: CategoryWithTotals }) {
  const styles = useThemedStyles(makeStyles);
  const warning = deleteWarning(category);

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text accessibilityRole="header" style={styles.question}>
        {warning.title}
      </Text>
      <Text style={styles.warning}>{warning.body}</Text>
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
  });
