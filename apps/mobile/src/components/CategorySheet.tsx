import { Modal, StyleSheet, View } from 'react-native';
import type { Category } from '@/api/types';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { CategoryTile } from '@/components/CategoryTile';
import { Chip } from '@/components/Chip';
import { IconButton } from '@/components/IconButton';
import { PhoneColumn } from '@/components/PhoneColumn';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { type Palette, radius, space } from '@/theme';

interface Props {
  visible: boolean;
  categories: Category[];
  onPick: (category: Category) => void;
  onClose: () => void;
}

/** "All categories" bottom sheet from the Add expense design. */
export function CategorySheet({ visible, categories, onPick, onClose }: Props) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* On web the modal covers the whole window; keep the sheet in the app's column, and close on clicks beside it. */}
      <PhoneColumn onPressOutside={onClose}>
        <View style={styles.backdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close category list"
            style={{ flex: 1 }}
            onPress={onClose}
          />
          <View accessibilityViewIsModal style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.head}>
              <Text variant="title">All categories</Text>
              <IconButton icon="close" label="Close" tone="muted" onPress={onClose} style={styles.close} />
            </View>
            <Text variant="caption" color="muted">
              Your pick takes the last spot in the quick row.
            </Text>
            <View style={styles.grid}>
              {categories.map((c) => (
                <Chip
                  key={c.categoryId}
                  label={c.displayName}
                  leading={<CategoryTile techName={c.techName} label={c.displayName} size={28} />}
                  onPress={() => onPick(c)}
                  style={styles.item}
                />
              ))}
            </View>
          </View>
        </View>
      </PhoneColumn>
    </Modal>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: colors.backdrop },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingTop: space.sm,
      paddingHorizontal: space.xl,
      paddingBottom: space.xxxl,
      gap: space.lg,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.faint,
    },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    close: { marginRight: -space.sm },
    // The 44pt touch areas meet, 12pt between the pills.
    grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.sm },
    item: { width: '48.5%' },
  });
