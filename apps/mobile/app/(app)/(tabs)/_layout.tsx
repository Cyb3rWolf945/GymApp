import { Tabs } from 'expo-router';
import { PlanDataProvider } from '../../../src/home/usePlanData';
import { en } from '../../../src/copy/en';
import { useTheme } from '../../../src/theme';

const t = en.home.tabs;

export default function TabsLayout() {
  const { colors, minTapTarget } = useTheme();
  return (
    <PlanDataProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: minTapTarget + 16 },
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
          tabBarIconStyle: { display: 'none' },
          tabBarItemStyle: { justifyContent: 'center', minHeight: minTapTarget },
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
