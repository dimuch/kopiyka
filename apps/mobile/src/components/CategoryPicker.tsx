import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Category } from '@/api/types';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { Chip } from '@/components/Chip';
import { CategorySheet } from '@/components/CategorySheet';
import { CategoryTile } from '@/components/CategoryTile';
import { Icon } from '@/components/Icon';
import { type Palette, space, text } from '@/theme';

interface Props {
  /** Shown as tiles. */
  quick: Category[];
  /** Behind the "N more" tile, in a sheet. */
  more: Category[];
  selectedId: number | null;
  onPick: (category: Category) => void;
  /** The selection shows, but nothing can be picked (brief 041). */
  disabled?: boolean;
}

/** The quick category tiles, plus a sheet with the rest. */
export function CategoryPicker({ quick, more, selectedId, onPick, disabled = false }: Props) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <View style={styles.grid}>
      {quick.map((c) => {
        const on = c.categoryId === selectedId;
        return (
          <Chip key={c.categoryId} selected={on} disabled={disabled} onPress={() => onPick(c)} style={styles.cat}>
            <CategoryTile techName={c.techName} label={c.displayName} size={26} />
            <Text numberOfLines={1} style={styles.catText}>
              {c.displayName}
            </Text>
          </Chip>
        );
      })}
      {more.length > 0 && (
        <Chip
          accessibilityLabel="More categories"
          disabled={disabled}
          onPress={() => setSheetOpen(true)}
          style={[styles.cat, styles.more]}
        >
          <Icon name="more" color={colors.muted} />
          <Text style={[styles.catText, { color: colors.muted, flex: 0 }]}>{more.length} more</Text>
        </Chip>
      )}
      <CategorySheet
        visible={sheetOpen}
        categories={more}
        onClose={() => setSheetOpen(false)}
        onPick={(c) => {
          setSheetOpen(false);
          onPick(c);
        }}
      />
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    cat: { width: '31.5%' },
    catText: { ...text.label, flex: 1, color: colors.text },
    // "N more" opens the sheet rather than picking, so it's drawn as an empty slot (a one-off, until brief 105).
    more: {
      borderStyle: 'dashed',
      borderColor: colors.borderStrongest,
      backgroundColor: 'transparent',
      justifyContent: 'center',
    },
  });
