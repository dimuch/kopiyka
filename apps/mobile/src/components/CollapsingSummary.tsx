import { useMemo, useState } from 'react';
import { Animated, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { Text } from '@/components/Text';
import { eur } from '@/format';
import { type Palette, space } from '@/theme';

/**
 * Scroll-linked hand-off from the "Spent" card to a compact total in the top bar:
 * as the card scrolls under the bar it fades out and the compact total slides in.
 * Driven natively from the scroll position, so it stays smooth while scrolling.
 */
export function useCollapsingSummary() {
  const [scrollY] = useState(() => new Animated.Value(0));
  // Where the card sits in the scroll content; refined by onLayout.
  const [card, setCard] = useState({ y: 0, height: 110 });

  // A new Animated.event is re-attached to the native scroll view, so keep one per screen.
  const onScroll = useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true }),
    [scrollY],
  );
  const animated = useMemo(() => {
    const fadeFrom = card.y + card.height * 0.25;
    const fadeTo = card.y + card.height * 0.85;
    const range = (out: [number, number]) =>
      scrollY.interpolate({ inputRange: [fadeFrom, fadeTo], outputRange: out, extrapolate: 'clamp' });
    return {
      cardStyle: { opacity: range([1, 0]), transform: [{ scale: range([1, 0.97]) }] },
      compactStyle: { opacity: range([0, 1]), transform: [{ translateY: range([10, 0]) }] },
      dividerStyle: { opacity: range([0, 1]) },
    };
  }, [scrollY, card]);

  return {
    scrollProps: { onScroll, scrollEventThrottle: 16 },
    onCardLayout: (e: LayoutChangeEvent) => {
      const { y, height } = e.nativeEvent.layout;
      setCard({ y, height });
    },
    ...animated,
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
  const styles = useThemedStyles(makeStyles);
  const over = budgetCents != null && spentCents > budgetCents;
  const amounts = budgetCents != null ? `${eur(spentCents)} of ${eur(budgetCents)} spent` : `${eur(spentCents)} spent`;
  return (
    <Animated.View
      accessible
      accessibilityLabel={label ? `${label}, ${amounts}` : amounts}
      style={[styles.compact, style]}
    >
      {label ? (
        <Text numberOfLines={1} variant="label" color="muted" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <Text variant="headingDisplay" color={over ? 'over' : 'text'} tabular>
        {eur(spentCents)}
      </Text>
      {budgetCents != null && (
        <Text variant="label" color="muted" tabular>
          {` / ${eur(budgetCents)}`}
        </Text>
      )}
    </Animated.View>
  );
}

/** Hairline under the top bar, shown once content scrolls beneath it. */
export function HeaderDivider({ style }: { style: object }) {
  const styles = useThemedStyles(makeStyles);
  return <Animated.View pointerEvents="none" style={[styles.divider, style]} />;
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    compact: { flexDirection: 'row', alignItems: 'baseline', flexShrink: 1 },
    label: { flexShrink: 1, marginRight: space.sm },
    divider: { position: 'absolute', left: -20, right: -20, bottom: 0, height: 1, backgroundColor: colors.border },
  });
