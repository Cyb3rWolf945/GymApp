import { Tabs } from 'expo-router';
import { PlanDataProvider } from '../../../src/home/usePlanData';
import { en } from '../../../src/copy/en';
import { SIDE_NAV_WIDTH, useBreakpoint, useTheme } from '../../../src/theme';

const t = en.home.tabs;

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
          tabBarPosition: side ? 'left' : 'bottom',
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: side
            ? { backgroundColor: colors.surface, borderRightColor: colors.border, borderRightWidth: 1, width: SIDE_NAV_WIDTH[bp], paddingTop: spacing.xl }
            : { backgroundColor: colors.surface, borderTopColor: colors.border, height: minTapTarget + 16 },
          // In the rail the label is the tap target: line height plus padding makes it at least `minTapTarget` tall.
          tabBarLabelStyle: side ? { fontSize: 16, lineHeight: 24, paddingVertical: (minTapTarget - 24) / 2, fontWeight: '600', textAlign: 'left' } : { fontSize: 12, fontWeight: '600' },
          tabBarIconStyle: { display: 'none' },
          tabBarItemStyle: side
            ? { justifyContent: 'center', alignItems: 'flex-start', minHeight: minTapTarget, paddingHorizontal: spacing.lg }
            : { justifyContent: 'center', minHeight: minTapTarget },
        }}
      >
        <Tabs.Screen name="index" options={{ title: t.today }} />
        <Tabs.Screen name="plan" options={{ title: t.plan }} />
        <Tabs.Screen name="nutrition" options={{ title: t.nutrition }} />
        <Tabs.Screen name="progress" options={{ title: t.progress }} />
        <Tabs.Screen name="settings" options={{ title: t.settings }} />
      </Tabs>
    </PlanDataProvider>
  );
}
