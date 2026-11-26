import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { PlanDataProvider } from '../../../src/home/usePlanData';
import { Icon, type IconName } from '../../../src/ui';
import { en } from '../../../src/copy/en';
import { SIDE_NAV_WIDTH, fonts, useBreakpoint, useTheme } from '../../../src/theme';

const t = en.home.tabs;

/** Outline when idle, filled when active. */
const ICONS: Record<string, [IconName, IconName]> = {
  index: ['flash-outline', 'flash'],
  plan: ['calendar-outline', 'calendar'],
  nutrition: ['restaurant-outline', 'restaurant'],
  progress: ['stats-chart-outline', 'stats-chart'],
  settings: ['settings-outline', 'settings'],
};
const tabIcon = (name: keyof typeof ICONS) => ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => <Icon name={ICONS[name][focused ? 1 : 0]} size={size} color={color as string} />;

/**
 * The same five tabs everywhere. On phones (`compact`) they are a bottom bar. From 600 px wide (tablets, desktop web)
 * they become a left side navigation with the same labels, and the content fills the rest of the width.
 */
export default function TabsLayout() {
  const { colors, spacing, minTapTarget } = useTheme();
  const bp = useBreakpoint();
  const side = bp !== 'compact';
  return (
    <PlanDataProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          // The scene behind each tab: the theme background, so the cross-fade between tabs never passes through another colour.
          sceneStyle: { backgroundColor: colors.background },
          tabBarPosition: side ? 'left' : 'bottom',
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.muted,
          tabBarActiveBackgroundColor: side ? colors.surfaceAlt : undefined,
          tabBarStyle: side
            ? { backgroundColor: colors.surface, borderRightColor: colors.border, borderRightWidth: 1, width: SIDE_NAV_WIDTH[bp], minWidth: SIDE_NAV_WIDTH[bp], maxWidth: SIDE_NAV_WIDTH[bp], paddingTop: spacing.xl }
            : { backgroundColor: colors.surface, borderTopColor: colors.border, height: minTapTarget + 24, paddingTop: spacing.xs },
          // In the rail the label is the tap target: line height plus padding makes it at least `minTapTarget` tall.
          tabBarLabelStyle: side ? { fontFamily: fonts.uiSemiBold, fontSize: 16, lineHeight: 24, paddingVertical: (minTapTarget - 24) / 2, textAlign: 'left' } : { fontFamily: fonts.uiSemiBold, fontSize: 12 },
          tabBarItemStyle: side
            ? { justifyContent: 'center', alignItems: 'flex-start', minHeight: minTapTarget, paddingHorizontal: spacing.lg }
            : { justifyContent: 'center', minHeight: minTapTarget },
        }}
      >
        <Tabs.Screen name="index" options={{ title: t.today, tabBarIcon: tabIcon('index') }} />
        <Tabs.Screen name="plan" options={{ title: t.plan, tabBarIcon: tabIcon('plan') }} />
        <Tabs.Screen name="nutrition" options={{ title: t.nutrition, tabBarIcon: tabIcon('nutrition') }} />
        <Tabs.Screen name="progress" options={{ title: t.progress, tabBarIcon: tabIcon('progress') }} />
        <Tabs.Screen name="settings" options={{ title: t.settings, tabBarIcon: tabIcon('settings') }} />
      </Tabs>
    </PlanDataProvider>
  );
}
