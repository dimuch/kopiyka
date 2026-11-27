import { Text, View } from 'react-native';
import { useAppearance } from '@/appearance/AppearanceContext';
import { categoryTile, fonts, radius } from '@/theme';

export function CategoryTile({ techName, label, size = 40 }: { techName: string; label: string; size?: number }) {
  const { scheme } = useAppearance();
  const tile = categoryTile(techName, scheme);
  return (
    <View
      style={{
        width: size,
        height: size,
        // A circle at any size: one tile shape, matching the chip's round ends.
        borderRadius: radius.pill,
        backgroundColor: tile.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: fonts.extraBold,
          // The letter scales with the tile (26–52pt): tile maths, no token.
          // eslint-disable-next-line no-restricted-syntax
          fontSize: size * 0.43,
          color: tile.fg,
        }}
      >
        {/* By code point: an emoji is two UTF-16 units. */}
        {[...label][0]?.toUpperCase()}
      </Text>
    </View>
  );
}
