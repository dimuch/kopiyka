import { StyleSheet, View } from 'react-native';
import { useAppearance, useThemedStyles } from '@/appearance/AppearanceContext';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import type { UndoOffer } from '@/data/undo';
import { type Palette, radius, shadow, size, space } from '@/theme';

/** The scroll room a screen leaves under its content while the bar shows: its bottom offset, its height and a 16pt gap. */
export const toastRoom = space.xxxl + size.toast + space.lg;

/**
 * The bar over the bottom of a screen after a delete: what went and Undo, Retry after a failed Undo, or only the
 * reason after a refused one.
 */
export function UndoToast({ offer, onUndo }: { offer: UndoOffer; onUndo: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const { scheme } = useAppearance();
  return (
    <View accessibilityLiveRegion="polite" style={[styles.toast, { boxShadow: shadow[scheme].float }]}>
      <Text
        numberOfLines={2}
        variant="bodyMedium"
        style={[styles.toastText, offer.status === 'refused' && styles.refusedText]}
      >
        {offer.status === 'refused' ? offer.text : offer.status === 'failed' ? 'Couldn’t undo' : offer.undo.message}
      </Text>
      {offer.status === 'refused' ? null : (
        <Pressable
          accessibilityRole="button"
          disabled={offer.status === 'restoring'}
          onPress={onUndo}
          style={[styles.undo, offer.status === 'restoring' && { opacity: 0.6 }]}
        >
          <Text variant="bodyStrong" color="accent">
            {offer.status === 'failed' ? 'Retry' : 'Undo'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    toast: {
      position: 'absolute',
      left: space.xl,
      right: space.xl,
      bottom: space.xxxl,
      minHeight: size.toast,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: space.lg,
      gap: space.md,
    },
    toastText: { flex: 1 },
    // No button to its right, so it keeps the bar's padding on both sides.
    refusedText: { paddingRight: space.lg, paddingVertical: space.sm },
    undo: { height: size.toast, paddingHorizontal: space.lg, justifyContent: 'center' },
  });
