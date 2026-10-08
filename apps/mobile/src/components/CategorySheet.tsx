import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Category } from '@/api/types';
import { CategoryTile } from '@/components/CategoryTile';
import { Icon } from '@/components/Icon';
import { PhoneColumn } from '@/components/PhoneColumn';
import { colors, fonts } from '@/theme';

interface Props {
  visible: boolean;
  categories: Category[];
  onPick: (category: Category) => void;
  onClose: () => void;
}

/** "All categories" bottom sheet from the Add expense design. */
export function CategorySheet({ visible, categories, onPick, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* On web the modal covers the whole window; keep the sheet in the app's column. */}
      <PhoneColumn>
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
              <Text style={styles.title}>All categories</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
                <Icon name="close" color={colors.muted} />
              </Pressable>
            </View>
            <Text style={styles.hint}>Your pick takes the last spot in the quick row.</Text>
            <View style={styles.grid}>
              {categories.map((c) => (
                <Pressable key={c.categoryId} accessibilityRole="button" onPress={() => onPick(c)} style={styles.item}>
                  <CategoryTile techName={c.techName} label={c.displayName} size={28} />
                  <Text numberOfLines={1} style={styles.itemText}>
                    {c.displayName}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </PhoneColumn>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.backdrop },
  sheet: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.borderStrong,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 14,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrongest },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
  close: { width: 44, height: 44, marginRight: -10, alignItems: 'center', justifyContent: 'center' },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  item: {
    width: '48.5%',
    height: 48,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
  },
  itemText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
});
