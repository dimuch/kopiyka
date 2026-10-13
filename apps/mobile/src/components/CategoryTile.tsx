import { Text, View } from 'react-native';
import { useAppearance } from '@/appearance/AppearanceContext';
import { categoryTile, fonts } from '@/theme';

export function CategoryTile({ techName, label, size = 40 }: { techName: string; label: string; size?: number }) {
  const { scheme } = useAppearance();
  const tile = categoryTile(techName, scheme);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: tile.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: fonts.display, fontSize: size * 0.43, color: tile.fg }}>
        {label.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}
