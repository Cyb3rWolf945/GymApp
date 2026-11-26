import { type ReactNode, useRef } from 'react';
import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { en } from '../copy/en';
import { FadeSlideIn } from '../motion';
import { useTheme } from '../theme';
import { EmptyState, ScreenSkeleton, Screen } from '../ui';
import { type PlanData, usePlanData } from './usePlanData';

/** Loading, error and empty states shared by the plan tabs; renders `children` once the plan is ready. */
export function PlanGate({ children }: { children: (data: PlanData) => ReactNode }) {
  const { state, reload } = usePlanData();
  const router = useRouter();
  const { colors } = useTheme();
  const t = en.home;
  // Only a skeleton that was really shown gives way to the content with a fade. With the data already there (a tab switch) the
  // tab's own cross-fade is the one entrance, so a screen change never stacks a second fade on it.
  const sawSkeleton = useRef(false);
  if (state.status === 'loading') sawSkeleton.current = true;

  if (state.status === 'loading') {
    return <Screen variant="dashboard"><ScreenSkeleton label={en.common.loading} /></Screen>;
  }
  if (state.status === 'error') {
    return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}><EmptyState kind="error" title={t.loadError} actionLabel={en.common.retry} onAction={reload} /></View>;
  }
  if (state.status === 'empty') {
    // A brand-new account goes straight to plan generation (screen 14).
    if (!state.hasJobs) return <Redirect href="/generating" />;
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
        <EmptyState kind="workout" title={t.emptyTitle} body={t.emptyBody} actionLabel={t.emptyCta} onAction={() => router.push('/generating')} />
      </View>
    );
  }
  return sawSkeleton.current ? <FadeSlideIn style={{ flex: 1 }}>{children(state.data)}</FadeSlideIn> : <>{children(state.data)}</>;
}
