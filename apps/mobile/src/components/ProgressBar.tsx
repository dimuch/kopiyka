import { StyleSheet, View } from 'react-native';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import type { BudgetState } from '@/data/budgetProgress';
import { type Palette, progressColor, radius } from '@/theme';

/** A category's spending against its plan: `fill` 0–1 of the track (BudgetProgress.fill), coloured by `state`. The
 *  design system's bar: a 4pt track, and a fill that ends in an 8pt dot. */
export function ProgressBar({ fill, state }: { fill: number; state: BudgetState }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const color = progressColor(state, colors);
  return (
    <View style={styles.track}>
      {fill > 0 && (
        <View style={[styles.bar, { width: `${fill * 100}%`, backgroundColor: color }]}>
          <View style={[styles.dot, { backgroundColor: color }]} />
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    // No `overflow: 'hidden'`: the dot stands 2pt above and below the track, into the row's gap.
    track: { height: 4, backgroundColor: colors.track, borderRadius: radius.pill },
    // At least the dot's width, and the dot sits flush with the bar's end, so a full bar's dot ends where the track
    // does.
    bar: { height: 4, minWidth: 8, borderRadius: radius.pill, justifyContent: 'center', alignItems: 'flex-end' },
    dot: { width: 8, height: 8, borderRadius: radius.pill },
  });
