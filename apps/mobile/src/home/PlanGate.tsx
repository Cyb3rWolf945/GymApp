import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { en } from '../copy/en';
import { useTheme } from '../theme';
import { EmptyState, ScreenSkeleton, Screen } from '../ui';
import { type PlanData, usePlanData } from './usePlanData';

/** Loading, error and empty states shared by the plan tabs; renders `children` once the plan is ready. */
export function PlanGate({ children }: { children: (data: PlanData) => ReactNode }) {
  const { state, reload } = usePlanData();
  const router = useRouter();
  const { colors } = useTheme();
  const t = en.home;

  if (state.status === 'loading') {
    return <Screen variant="dashboard"><ScreenSkeleton label={en.common.loading} /></Screen>;
  }
  if (state.status === 'error') {
    return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}><EmptyState title={t.loadError} actionLabel={en.common.retry} onAction={reload} /></View>;
  }
  if (state.status === 'empty') {
    // A brand-new account goes straight to plan generation (screen 14).
    if (!state.hasJobs) return <Redirect href="/generating" />;
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
        <EmptyState title={t.emptyTitle} body={t.emptyBody} actionLabel={t.emptyCta} onAction={() => router.push('/generating')} />
      </View>
    );
  }
  return <>{children(state.data)}</>;
}
