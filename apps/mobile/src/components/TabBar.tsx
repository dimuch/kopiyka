import { router } from 'expo-router';
import { PlatformPressable, useNavigationState } from 'expo-router/react-navigation';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppearance, useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { Icon } from '@/components/Icon';
import { pressedOpacity } from '@/components/Pressable';
import { readTabs, type TabItem, type TabName, useTabItems } from '@/data/tabItems';
import { tabHref } from '@/tabRoutes';
import { fonts, type Palette, radius, shadow, size, space } from '@/theme';

// Today's icon and badge sizes, from the library bar the tab pages drew before brief 106.
const ICON_BOX = { width: 31, height: 28 };
const ICON_SIZE = 25;
const BADGE_SIZE = ICON_SIZE * 0.75;

/** The floating bar's distance from the screen's bottom: 20, or the home indicator's inset where that's more. */
function barBottom(inset: number): number {
  return Math.max(inset, space.xl);
}

/** The room a scroll view leaves under its content so its last row can scroll above the floating tab bar. */
export function useTabBarRoom(): number {
  const insets = useSafeAreaInsets();
  return barBottom(insets.bottom) + size.tabBar + space.lg;
}

/**
 * The tab bar, on the tab pages and on the pages pushed above them (brief 106: one bar for both). `active` and `params`
 * come from `readTabs`; `onTabPress` runs on every plain tab tap, the open tab's included.
 */
export function TabBar({
  active,
  params,
  onTabPress,
}: {
  active: TabName;
  params: Partial<Record<TabName, Record<string, string>>>;
  onTabPress: (tab: TabItem) => void;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { scheme } = useAppearance();
  const insets = useSafeAreaInsets();
  const { tabs } = useTabItems();
  const float = { boxShadow: shadow[scheme].float };

  return (
    // A floating pill over the page (the design system's TabBar); the pages leave room for it (`useTabBarRoom`).
    <View style={[styles.dock, { bottom: barBottom(insets.bottom) }]}>
      <View role="tablist" style={[styles.pill, float]}>
        {tabs.map((tab, position) => {
          const focused = tab.name === active;
          const { badge, label } = tab;
          const color = focused ? colors.accent : colors.muted;
          return (
            // A link on web, so a Cmd-click or middle click opens the tab in a new browser tab, while a plain click
            // navigates in the app (PlatformPressable only takes plain left clicks). On iOS the href is ignored.
            <PlatformPressable
              key={tab.name}
              href={tabHref(tab.href, params[tab.name])}
              pressOpacity={pressedOpacity}
              // Same roles and names as the library bar: iOS reads "Settings, 1 invite, tab, 6 of 6". The aria props, not
              // accessibility*, because react-native-web only renders aria-label and aria-selected from these. The role
              // comes after PlatformPressable's own `link`, so it wins.
              role={Platform.select({ ios: 'button', default: 'tab' })}
              aria-selected={focused}
              aria-label={Platform.OS === 'ios' ? `${label}, tab, ${position + 1} of ${tabs.length}` : label}
              accessibilityShowsLargeContentViewer
              accessibilityLargeContentTitle={label}
              onPress={() => onTabPress(tab)}
              style={styles.item}
            >
              <View style={ICON_BOX}>
                <View style={styles.icon}>
                  <Icon name={tab.icon} color={color} size={ICON_SIZE} />
                </View>
                {badge !== undefined ? <Text style={styles.badge}>{badge}</Text> : null}
              </View>
            </PlatformPressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * The tab bar for pages pushed above the tabs (brief 062). A tap leaves the page for that tab, passing the tab's
 * current params so Budget and Income keep their month. `fallback` is the tab shown active when the page was opened
 * from a link, with no tabs underneath.
 */
export function PageTabBar({ fallback }: { fallback: TabName }) {
  const routes = useNavigationState((state) => state.routes);
  const { active, params } = readTabs(routes, fallback);
  return (
    <TabBar
      active={active}
      params={params}
      onTabPress={(tab) => {
        const tabParams = params[tab.name];
        router.dismissTo(tabParams ? { pathname: tab.href, params: tabParams } : tab.href);
      }}
    />
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    dock: {
      position: 'absolute',
      left: space.xl,
      right: space.xl,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      pointerEvents: 'box-none',
    },
    pill: {
      flex: 1,
      flexDirection: 'row',
      height: size.tabBar,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
    },
    item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    icon: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
    badge: {
      position: 'absolute',
      top: -3,
      end: -3,
      height: BADGE_SIZE,
      minWidth: BADGE_SIZE,
      borderRadius: radius.pill,
      paddingHorizontal: space.xs,
      overflow: 'hidden',
      textAlign: 'center',
      // Inter at the regular weight Badge.js uses; `(tabs)/_layout.tsx` sets the same on the library bar's badge.
      fontFamily: fonts.regular,
      // Badge.js sizes its text from the badge: layout maths, no role.
      // eslint-disable-next-line no-restricted-syntax
      fontSize: Math.floor((BADGE_SIZE * 3) / 4),
      // Badge.js sizes its text from the badge: layout maths, no role.
      // eslint-disable-next-line no-restricted-syntax
      lineHeight: BADGE_SIZE - 1,
      color: colors.onAccent,
      backgroundColor: colors.accent,
    },
  });
}
