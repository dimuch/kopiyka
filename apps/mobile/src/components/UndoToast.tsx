import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { Pressable } from '@/components/Pressable';
import type { UndoOffer } from '@/data/undo';
import { fonts, type Palette, radius, space, text } from '@/theme';

/**
 * The bar over the bottom of a screen after a delete: what went and Undo, Retry after a failed Undo, or only the
 * reason after a refused one.
 */
export function UndoToast({ offer, onUndo }: { offer: UndoOffer; onUndo: () => void }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View accessibilityLiveRegion="polite" style={styles.toast}>
      <Text numberOfLines={2} style={[styles.toastText, offer.status === 'refused' && styles.refusedText]}>
        {offer.status === 'refused' ? offer.text : offer.status === 'failed' ? 'Couldn’t undo' : offer.undo.message}
      </Text>
      {offer.status === 'refused' ? null : (
        <Pressable
          accessibilityRole="button"
          disabled={offer.status === 'restoring'}
          onPress={onUndo}
          style={[styles.undo, offer.status === 'restoring' && { opacity: 0.6 }]}
        >
          <Text style={styles.undoText}>{offer.status === 'failed' ? 'Retry' : 'Undo'}</Text>
        </Pressable>
      )}
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
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: space.lg,
      gap: space.md,
    },
    toastText: { ...text.body, flex: 1, fontFamily: fonts.bodyMedium, color: colors.text },
    // No button to its right, so it keeps the bar's padding on both sides.
    refusedText: { paddingRight: space.lg, paddingVertical: space.sm },
    undo: { height: 56, paddingHorizontal: space.lg, justifyContent: 'center' },
    undoText: { ...text.bodyStrong, color: colors.accent },
  });
