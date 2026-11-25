import { type Href, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useCardStyle } from '@/components/Card';
import { Icon, type IconName } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { type Palette, space } from '@/theme';

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
  const cardStyle = useCardStyle('padded');
  return (
    <View style={styles.grid}>
      {cards.map((card) => (
        <Pressable
          key={card.title}
          accessibilityRole="button"
          accessibilityLabel={`${card.title}, ${card.figure ?? (card.failed ? 'not available' : 'loading')}`}
          onPress={() => router.navigate(card.href)}
          style={[cardStyle, styles.card]}
        >
          <Icon name={card.icon} color={colors.accent} size={24} />
          <Text variant="bodyMedium">{card.title}</Text>
          <Text numberOfLines={1} variant="title" color={card.figure === null ? 'muted' : 'text'} tabular>
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
      gap: space.sm,
    },
  });
