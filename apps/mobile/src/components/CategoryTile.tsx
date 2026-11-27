import { Text, View } from 'react-native';
import { useAppearance } from '@/appearance/AppearanceContext';
import { findCategoryIcon } from '@/components/categoryIcons';
import { StrokeIcon } from '@/components/Icon';
import { categoryTile, fonts, radius } from '@/theme';

/** A category's round tile: its icon when it has one this build knows (brief 114), else its first letter. */
export function CategoryTile({
  techName,
  label,
  icon,
  size = 40,
}: {
  techName: string;
  label: string;
  icon: string | null;
  size?: number;
}) {
  const { scheme } = useAppearance();
  const tile = categoryTile(techName, scheme);
  const drawn = findCategoryIcon(icon);
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
      {drawn ? (
        // The icon scales with the tile (26–52pt), leaving a ring of colour round it.
        <StrokeIcon paths={drawn.paths} size={size * 0.55} color={tile.fg} />
      ) : (
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
      )}
    </View>
  );
}
