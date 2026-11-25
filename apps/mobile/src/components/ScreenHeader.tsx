import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { Button } from '@/components/Button';
import { HeaderDivider } from '@/components/CollapsingSummary';
import { HomeButton } from '@/components/HomeButton';
import { Icon } from '@/components/Icon';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { Pressable } from '@/components/Pressable';
import { fonts, type Palette, size, space, text } from '@/theme';

/** On a screen whose list scrolls under the header: the hairline's opacity from `useCollapsingSummary`. */
type Collapsing = { dividerStyle?: object };

type Props =
  | {
      /** The forms: a text Back and a centred title. */
      variant: 'modal';
      title: string;
      onBack: () => void;
      /** While a save is in flight. */
      disabled?: boolean;
    }
  | ({
      /** Budget, Income and Expenses: Home, the month switcher, and the tab's action on equal-width sides. */
      variant: 'month';
      /** The tab's title for MonthSwitcher's caption, not a title the header draws (unlike `modal`'s). */
      title: string;
      month: string;
      onMonthChange: (month: string) => void;
      trailing?: ReactNode;
    } & Collapsing)
  | ({
      /** The category page and Members: Back with an icon and a label. */
      variant: 'page';
      /** The month the category page returns to, or "Back". */
      backLabel: string;
      onBack: () => void;
      trailing?: ReactNode;
    } & Collapsing);

/** A screen's top row, in one of three looks (`variant`). The screen keeps its own top padding. */
export function ScreenHeader(props: Props) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  if (props.variant === 'modal') {
    return (
      <View style={styles.modal}>
        <Button
          variant="mutedText"
          size="compact"
          label="Back"
          disabled={props.disabled}
          onPress={props.onBack}
          style={styles.modalBack}
        />
        <Text accessibilityRole="header" style={styles.title}>
          {props.title}
        </Text>
        <View style={styles.spacer} />
      </View>
    );
  }
  const lifted = props.dividerStyle ? styles.lifted : null;
  const divider = props.dividerStyle ? <HeaderDivider style={props.dividerStyle} /> : null;
  if (props.variant === 'month') {
    return (
      <View style={[styles.month, lifted]}>
        <View style={styles.side}>
          <HomeButton />
        </View>
        <MonthSwitcher title={props.title} month={props.month} onChange={props.onMonthChange} />
        <View style={[styles.side, styles.sideEnd]}>{props.trailing}</View>
        {divider}
      </View>
    );
  }
  return (
    <View style={[styles.page, lifted]}>
      <Pressable accessibilityRole="button" onPress={props.onBack} style={styles.pageBack}>
        <Icon name="back" color={colors.muted} />
        <Text style={styles.backText}>{props.backLabel}</Text>
      </Pressable>
      {props.trailing !== undefined ? <View style={styles.trailing}>{props.trailing}</View> : null}
      {divider}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    modal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
    modalBack: { marginLeft: -space.sm, paddingHorizontal: space.sm },
    title: { ...text.heading, fontFamily: fonts.display, color: colors.text },
    // About Back's width, so the title sits near the row's centre.
    spacer: { width: 52 },
    month: { flexDirection: 'row', alignItems: 'center', paddingBottom: space.sm },
    // Equal-width sides keep the month switcher on the header's true centre; flexBasis 0 matters on web.
    side: { flex: 1, flexBasis: 0, flexDirection: 'row' },
    sideEnd: { justifyContent: 'flex-end' },
    page: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.md,
      paddingBottom: space.sm,
    },
    pageBack: {
      height: size.iconButton,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
      marginLeft: -space.sm,
      paddingHorizontal: space.sm,
    },
    backText: { ...text.body, fontFamily: fonts.bodyMedium, color: colors.muted },
    trailing: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 1 },
    // Over the list that scrolls under the header.
    lifted: { zIndex: 1 },
  });
