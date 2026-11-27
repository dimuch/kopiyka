import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { space } from '@/theme';

type Figure = { label: string; value: string | undefined; over?: boolean };

/**
 * Three labelled figures across a row: the first at the start, the middle centred, the last at the end. A value still
 * loading shows as a muted '—'.
 */
export function FigureRow({ figures }: { figures: [Figure, Figure, Figure] }) {
  return (
    <>
      {figures.map((figure, index) => (
        <View
          key={figure.label}
          style={[styles.figure, index === 1 && styles.figureCentre, index === 2 && styles.figureEnd]}
        >
          <Text variant="caption" color="muted">
            {figure.label}
          </Text>
          {/* "—" in the value's own size until it loads, so the card keeps its height. */}
          <Text variant="amount" color={figure.over ? 'danger' : figure.value === undefined ? 'muted' : 'text'}>
            {figure.value ?? '—'}
          </Text>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  figure: { gap: space.xs },
  figureCentre: { alignItems: 'center' },
  figureEnd: { alignItems: 'flex-end' },
});
