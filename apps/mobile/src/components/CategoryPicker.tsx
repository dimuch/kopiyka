import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Category } from '@/api/types';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { Chip } from '@/components/Chip';
import { CategorySheet } from '@/components/CategorySheet';
import { CategoryTile } from '@/components/CategoryTile';
import { Icon } from '@/components/Icon';
import { type Palette, space } from '@/theme';

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
          <Chip
            key={c.categoryId}
            label={c.displayName}
            leading={<CategoryTile techName={c.techName} label={c.displayName} icon={c.icon} size={26} />}
            selected={on}
            disabled={disabled}
            onPress={() => onPick(c)}
            style={styles.cat}
          />
        );
      })}
      {more.length > 0 && (
        <Chip
          accessibilityLabel="More categories"
          label={`${more.length} more`}
          leading={<Icon name="more" color={colors.muted} />}
          disabled={disabled}
          onPress={() => setSheetOpen(true)}
          style={styles.cat}
        />
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
    // The 44pt touch areas meet, 12pt between the pills.
    grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.sm },
    cat: { width: '31.5%' },
  });
