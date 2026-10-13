import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import type { UndoOffer } from '@/data/undo';
import { fonts, type Palette } from '@/theme';

/** The bar over the bottom of a screen after a delete: what went and Undo, or Retry after a failed Undo. */
export function UndoToast({ offer, onUndo }: { offer: UndoOffer; onUndo: () => void }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View accessibilityLiveRegion="polite" style={styles.toast}>
      <Text numberOfLines={1} style={styles.toastText}>
        {offer.status === 'failed' ? 'Couldn’t undo' : offer.undo.message}
      </Text>
      <Pressable
        accessibilityRole="button"
        disabled={offer.status === 'restoring'}
        onPress={onUndo}
        style={[styles.undo, offer.status === 'restoring' && { opacity: 0.6 }]}
      >
        <Text style={styles.undoText}>{offer.status === 'failed' ? 'Retry' : 'Undo'}</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    toast: {
      position: 'absolute',
      left: 20,
      right: 20,
      bottom: 32,
      minHeight: 56,
      borderRadius: 18,
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 18,
      gap: 12,
    },
    toastText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
    undo: { height: 56, paddingHorizontal: 18, justifyContent: 'center' },
    undoText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.accent },
  });
