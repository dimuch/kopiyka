import { StyleSheet, View } from 'react-native';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import type { BudgetState } from '@/data/budgetProgress';
import { type Palette, progressColor, radius } from '@/theme';

/** A category's spending against its plan: `fill` 0–1 of the track (BudgetProgress.fill), coloured by `state`. */
export function ProgressBar({ fill, state }: { fill: number; state: BudgetState }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.track}>
      <View style={[styles.bar, { width: `${fill * 100}%`, backgroundColor: progressColor(state, colors) }]} />
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    track: { height: 5, backgroundColor: colors.track, borderRadius: radius.pill, overflow: 'hidden' },
    bar: { height: 5, borderRadius: radius.pill },
  });
