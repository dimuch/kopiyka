import { Tabs } from 'expo-router/js-tabs';
import { PlatformPressable } from 'expo-router/react-navigation';
import { Platform } from 'react-native';
import { useColors } from '@/appearance/AppearanceContext';
import { Icon } from '@/components/Icon';
import { pressedOpacity } from '@/components/Pressable';
import { useInvites } from '@/data/invites';
import { TABS, tabBadge } from '@/tabs';

export default function TabsLayout() {
  const colors = useColors();
  const { invites, reload } = useInvites();
  const count = invites?.length ?? 0;
  return (
    <Tabs
      // Every tab tap (and the return from a pushed screen) checks for new invites; there's no polling.
      screenListeners={{ focus: reload }}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.bg },
        // The library's tabs don't dim by default.
        tabBarButton: (props) => <PlatformPressable {...props} pressOpacity={pressedOpacity} />,
      }}
    >
      {TABS.map((tab) => {
        const { badge, label } = tabBadge(tab, count);
        return (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.title,
              // The label is hidden; iOS builds "Settings, 2 invites, tab, 6 of 6" from it.
              tabBarLabel: label,
              // Without labels the web tab has no name.
              tabBarAccessibilityLabel: Platform.OS === 'web' ? label : undefined,
              tabBarBadge: badge,
              tabBarBadgeStyle: { backgroundColor: colors.accent, color: colors.onAccent },
              tabBarIcon: ({ color, size }) => <Icon name={tab.icon} color={color} size={size} />,
            }}
          />
        );
      })}
    </Tabs>
  );
}
