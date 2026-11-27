import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { HeaderDivider } from '@/components/CollapsingSummary';
import { HomeButton } from '@/components/HomeButton';
import { IconButton } from '@/components/IconButton';
import { Text } from '@/components/Text';
import { size, space } from '@/theme';

/**
 * A screen's top row, in one shape: a round Back (or Home, with no `back`), a centred title, and one trailing
 * action. The row spans the screen with the gutter inside, so HeaderDivider draws edge to edge. The screen keeps its
 * own top padding.
 */
export function ScreenHeader({
  back,
  title,
  trailing,
  dividerStyle,
}: {
  /** The round back button; its label is the accessible name. Without it, the leading button is Home. */
  back?: { label: string; onPress: () => void; disabled?: boolean };
  /** A string is drawn as the screen's `title`; the month tabs pass their MonthSwitcher. */
  title?: ReactNode;
  trailing?: ReactNode;
  /** On a screen whose list scrolls under the header: the hairline's opacity from `useCollapsingSummary`. */
  dividerStyle?: object;
}) {
  return (
    <View style={[styles.row, dividerStyle && styles.lifted]}>
      <View style={styles.side}>
        {back ? (
          <IconButton icon="back" label={back.label} tone="muted" disabled={back.disabled} onPress={back.onPress} />
        ) : (
          <HomeButton />
        )}
      </View>
      {/* Drawn even with no title: it takes the row's middle and pushes the trailing side to the end. */}
      <View style={styles.title}>
        {typeof title === 'string' ? (
          <Text accessibilityRole="header" variant="title">
            {title}
          </Text>
        ) : (
          title
        )}
      </View>
      <View style={[styles.side, styles.trailing]}>{trailing}</View>
      {dividerStyle ? <HeaderDivider style={dividerStyle} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: -space.xl,
    paddingHorizontal: space.xl,
    paddingBottom: space.sm,
  },
  // At least a button wide on both sides, so the title sits on the screen's centre even with one side empty.
  side: { minWidth: size.iconButton, flexDirection: 'row', alignItems: 'center' },
  // flexBasis 0 matters on web.
  title: { flex: 1, flexBasis: 0, alignItems: 'center' },
  trailing: { justifyContent: 'flex-end', gap: space.xs, flexShrink: 1 },
  // Over the list that scrolls under the header.
  lifted: { zIndex: 1 },
});
