import { Tabs } from 'expo-router/js-tabs';
import { useColors } from '@/appearance/AppearanceContext';
import { TabBar } from '@/components/TabBar';
import { readTabs, useTabItems } from '@/data/tabItems';

export default function TabsLayout() {
  const colors = useColors();
  const { tabs, onTabFocus } = useTabItems();
  return (
    <Tabs
      screenListeners={{ focus: onTabFocus }}
      // One bar for both kinds of page (brief 106), so a tab page and a page above it draw the same bar. readTabs reads
      // the tab navigator's state as the root stack holds it, so both bars get the active tab and the string params
      // from one tested function.
      tabBar={({ state, navigateToTab }) => (
        <TabBar
          {...readTabs([{ name: '(tabs)', state }], 'index')}
          onTabPress={(tab) => {
            const index = state.routes.findIndex((route) => route.name === tab.name);
            if (index !== -1 && index !== state.index) navigateToTab(state.routes[index].key);
          }}
        />
      )}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title }} />
      ))}
    </Tabs>
  );
}
