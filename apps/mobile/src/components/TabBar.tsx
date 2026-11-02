import { router } from 'expo-router';
import { useNavigationState } from 'expo-router/react-navigation';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { Icon } from '@/components/Icon';
import { useInvites } from '@/data/invites';
import { readTabs, TABS, tabBadge, type TabName } from '@/tabs';
import type { Palette } from '@/theme';

// The library bar's phone metrics (expo-router 57, BottomTabBar.js, TabBarIcon.js, Badge.js), so this copy lines up
// with the bar on the tab pages. Recheck them after an expo-router upgrade.
const BAR_HEIGHT = 49;
const ICON_BOX = { width: 31, height: 28 };
const ICON_SIZE = 25;
const BADGE_SIZE = ICON_SIZE * 0.75;

/**
 * The tab bar for pages pushed above the tabs (brief 062). A tap leaves the page for that tab, passing the tab's
 * current params so Budget and Income keep their month. `fallback` is the tab shown active when the page was opened
 * from a link, with no tabs underneath.
 */
export function TabBar({ fallback }: { fallback: TabName }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const routes = useNavigationState((state) => state.routes);
  const { active, params } = readTabs(routes, fallback);
  const { invites } = useInvites();
  const count = invites?.length ?? 0;

  return (
    <View role="tablist" style={[styles.bar, { height: BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom }]}>
      {TABS.map((tab, position) => {
        const focused = tab.name === active;
        const { badge, label } = tabBadge(tab, count);
        const tabParams = params[tab.name];
        const color = focused ? colors.accent : colors.muted;
        return (
          <Pressable
            key={tab.name}
            // Same roles and names as the library bar: iOS reads "Settings, 1 invite, tab, 6 of 6".
            role={Platform.select({ ios: 'button', default: 'tab' })}
            aria-selected={focused}
            aria-label={Platform.OS === 'ios' ? `${label}, tab, ${position + 1} of ${TABS.length}` : label}
            onPress={() => router.dismissTo(tabParams ? { pathname: tab.href, params: tabParams } : tab.href)}
            style={styles.item}
          >
            <View style={ICON_BOX}>
              <View style={styles.icon}>
                <Icon name={tab.icon} color={color} size={ICON_SIZE} />
              </View>
              {badge !== undefined ? <Text style={styles.badge}>{badge}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      backgroundColor: colors.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    item: { flex: 1, alignItems: 'center', padding: 5 },
    icon: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
    badge: {
      position: 'absolute',
      top: -3,
      end: -3,
      height: BADGE_SIZE,
      minWidth: BADGE_SIZE,
      borderRadius: BADGE_SIZE / 2,
      paddingHorizontal: 4,
      overflow: 'hidden',
      textAlign: 'center',
      fontSize: Math.floor((BADGE_SIZE * 3) / 4),
      lineHeight: BADGE_SIZE - 1,
      color: colors.onAccent,
      backgroundColor: colors.accent,
    },
  });
}
