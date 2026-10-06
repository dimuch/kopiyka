import { useState } from 'react';
import { Animated, StyleSheet, Text, type LayoutChangeEvent } from 'react-native';
import { eur } from '@/format';
import { colors, fonts } from '@/theme';

/**
 * Scroll-linked hand-off from the "Spent" card to a compact total in the top bar:
 * as the card scrolls under the bar it fades out and the compact total slides in.
 * Driven natively from the scroll position, so it stays smooth while scrolling.
 */
export function useCollapsingSummary() {
  const [scrollY] = useState(() => new Animated.Value(0));
  // Where the card sits in the scroll content; refined by onLayout.
  const [card, setCard] = useState({ y: 0, height: 110 });

  const fadeFrom = card.y + card.height * 0.25;
  const fadeTo = card.y + card.height * 0.85;
  const range = (out: [number, number]) =>
    scrollY.interpolate({ inputRange: [fadeFrom, fadeTo], outputRange: out, extrapolate: 'clamp' });

  return {
    scrollProps: {
      onScroll: Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true }),
      scrollEventThrottle: 16,
    },
    onCardLayout: (e: LayoutChangeEvent) => {
      const { y, height } = e.nativeEvent.layout;
      setCard({ y, height });
    },
    cardStyle: { opacity: range([1, 0]), transform: [{ scale: range([1, 0.97]) }] },
    compactStyle: { opacity: range([0, 1]), transform: [{ translateY: range([10, 0]) }] },
    dividerStyle: { opacity: range([0, 1]) },
  };
}

/** "€2,078.85 / €4,600" in the top bar; the budget part appears once budgets exist. */
export function CompactTotal({
  spentCents,
  budgetCents,
  label,
  style,
}: {
  spentCents: number;
  budgetCents?: number | null;
  /** Shown before the amount when the screen's title has scrolled away, e.g. the category name. */
  label?: string;
  style: object;
}) {
  const over = budgetCents != null && spentCents > budgetCents;
  const amounts = budgetCents != null ? `${eur(spentCents)} of ${eur(budgetCents)} spent` : `${eur(spentCents)} spent`;
  return (
    <Animated.View
      accessible
      accessibilityLabel={label ? `${label}, ${amounts}` : amounts}
      style={[styles.compact, style]}
    >
      {label && (
        <Text numberOfLines={1} style={styles.label}>
          {label}
        </Text>
      )}
      <Text style={[styles.spent, over && { color: colors.over }]}>{eur(spentCents)}</Text>
      {budgetCents != null && <Text style={styles.budget}> / {eur(budgetCents)}</Text>}
    </Animated.View>
  );
}

/** Hairline under the top bar, shown once content scrolls beneath it. */
export function HeaderDivider({ style }: { style: object }) {
  return <Animated.View pointerEvents="none" style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({
  compact: { flexDirection: 'row', alignItems: 'baseline', flexShrink: 1 },
  label: { flexShrink: 1, marginRight: 6, fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.muted },
  spent: { fontFamily: fonts.display, fontSize: 18, color: colors.text, fontVariant: ['tabular-nums'] },
  budget: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.muted, fontVariant: ['tabular-nums'] },
  divider: { position: 'absolute', left: -20, right: -20, bottom: 0, height: 1, backgroundColor: colors.border },
});
