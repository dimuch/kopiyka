import { type Href, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { Icon, type IconName } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { fonts, type Palette, radius, space, text } from '@/theme';

export interface HomeCard {
  title: string;
  href: Href;
  icon: IconName;
  figure: string | null;
  failed: boolean;
}

/** Home's grid of cards, each opening its page; a null figure shows "—", read as loading or, if `failed`, not available. */
export function HomeCards({ cards }: { cards: readonly HomeCard[] }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.grid}>
      {cards.map((card) => (
        <Pressable
          key={card.title}
          accessibilityRole="button"
          accessibilityLabel={`${card.title}, ${card.figure ?? (card.failed ? 'not available' : 'loading')}`}
          onPress={() => router.navigate(card.href)}
          style={styles.card}
        >
          <Icon name={card.icon} color={colors.accent} size={24} />
          <Text style={styles.cardTitle}>{card.title}</Text>
          <Text numberOfLines={1} style={[styles.figure, card.figure === null && { color: colors.muted }]}>
            {card.figure ?? '—'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
    card: {
      // Two per row: each starts just under half the width and grows into the gap.
      flexBasis: '45%',
      flexGrow: 1,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      paddingVertical: space.lg,
      paddingHorizontal: space.lg,
      gap: space.sm,
    },
    cardTitle: { ...text.body, fontFamily: fonts.bodyMedium, color: colors.text },
    figure: { ...text.title, color: colors.text, fontVariant: ['tabular-nums'] },
  });
