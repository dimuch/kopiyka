import { Tabs } from 'expo-router/js-tabs';
import { Platform } from 'react-native';
import { useColors } from '@/appearance/AppearanceContext';
import { Icon, type IconName } from '@/components/Icon';
import { useInvites } from '@/data/invites';

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home' },
  { name: 'budget', title: 'Budget', icon: 'budget' },
  { name: 'expenses', title: 'Expenses', icon: 'expenses' },
  { name: 'statistics', title: 'Statistics', icon: 'stats' },
  { name: 'settings', title: 'Settings', icon: 'settings' },
];

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
      }}
    >
      {TABS.map((tab) => {
        // Settings carries the count of pending invites, which it lists. Screen readers don't read the badge, so
        // the tab's name says it too.
        const badge = tab.name === 'settings' && count > 0 ? count : undefined;
        const label = badge ? `${tab.title}, ${badge} ${badge === 1 ? 'invite' : 'invites'}` : tab.title;
        return (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.title,
              // The label is hidden; iOS builds "Settings, 2 invites, tab, 5 of 5" from it.
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
