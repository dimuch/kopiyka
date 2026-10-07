import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Category } from '@/api/types';
import { CategorySheet } from '@/components/CategorySheet';
import { CategoryTile } from '@/components/CategoryTile';
import { Icon } from '@/components/Icon';
import { colors, fonts } from '@/theme';

interface Props {
  /** Shown as tiles. */
  quick: Category[];
  /** Behind the "N more" tile, in a sheet. */
  more: Category[];
  selectedId: number | null;
  onPick: (category: Category) => void;
}

/** The quick category tiles, plus a sheet with the rest. */
export function CategoryPicker({ quick, more, selectedId, onPick }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <View style={styles.grid}>
      {quick.map((c) => {
        const on = c.categoryId === selectedId;
        return (
          <Pressable
            key={c.categoryId}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onPick(c)}
            style={[styles.cat, on && styles.catOn]}
          >
            <CategoryTile techName={c.techName} label={c.displayName} size={26} />
            <Text numberOfLines={1} style={styles.catText}>
              {c.displayName}
            </Text>
          </Pressable>
        );
      })}
      {more.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="More categories"
          onPress={() => setSheetOpen(true)}
          style={[styles.cat, styles.more]}
        >
          <Icon name="more" color={colors.muted} />
          <Text style={[styles.catText, { color: colors.muted, flex: 0 }]}>{more.length} more</Text>
        </Pressable>
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

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cat: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    width: '31.5%',
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catOn: { borderColor: colors.accent, backgroundColor: '#16233A' },
  catText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  more: {
    borderStyle: 'dashed',
    borderColor: '#3A404A',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    gap: 6,
  },
});
