import { Text, View } from 'react-native';
import { categoryTile, fonts } from '@/theme';

export function CategoryTile({ techName, label, size = 40 }: { techName: string; label: string; size?: number }) {
  const tile = categoryTile(techName);
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
