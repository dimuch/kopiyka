import { Tabs } from 'expo-router/js-tabs';
import { Platform } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { colors } from '@/theme';

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home' },
  { name: 'budget', title: 'Budget', icon: 'budget' },
  { name: 'expenses', title: 'Expenses', icon: 'expenses' },
  { name: 'statistics', title: 'Statistics', icon: 'stats' },
  { name: 'settings', title: 'Settings', icon: 'settings' },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            // Without labels the web tab has no name; iOS builds "Home, tab, 1 of 5" from the title itself.
            tabBarAccessibilityLabel: Platform.OS === 'web' ? t.title : undefined,
            tabBarIcon: ({ color, size }) => <Icon name={t.icon} color={color} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
