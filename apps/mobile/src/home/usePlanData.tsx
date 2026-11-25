import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { type Macros, type RecipeCandidate, type Weekday, buildPlanInputs, latestJobs } from '@gymapp/shared';
import { useAuth } from '../auth/AuthProvider';
import { fetchCatalogNames, fetchJobs } from '../plan/api';
import { supabase } from '../supabase';

export interface PlanData {
  workoutResult: unknown;
  nutritionResult: unknown;
  exerciseNames: Map<string, string>;
  recipes: RecipeCandidate[];
  preferredDays: Weekday[];
  /** Calorie/macro targets from the calc lib, when the profile is complete. */
  targets: { training: Macros; rest: Macros } | null;
}

export type PlanState =
  | { status: 'loading' }
  | { status: 'error' }
  /** No generated plan yet. `hasJobs` false = brand-new account. */
  | { status: 'empty'; hasJobs: boolean }
  | { status: 'ready'; data: PlanData };

interface Ctx {
  state: PlanState;
  reload: () => void;
}
const PlanContext = createContext<Ctx>({ state: { status: 'loading' }, reload: () => {} });
export const usePlanData = (): Ctx => useContext(PlanContext);

const slugsOf = (result: unknown, pick: (plan: Record<string, unknown>) => string[]): string[] => {
  const plan = (result as { plan?: Record<string, unknown> } | null | undefined)?.plan;
  return plan ? pick(plan) : [];
};

export function PlanDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<PlanState>({ status: 'loading' });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setState({ status: 'loading' });
    void (async () => {
      try {
        const rows = await fetchJobs(user.id);
        const jobs = latestJobs(rows.filter((r) => r.status === 'done'));
        if (!jobs.workout_plan || !jobs.nutrition_plan) return active && setState({ status: 'empty', hasJobs: rows.some((r) => r.status !== 'failed') });

        const exerciseSlugs = slugsOf(jobs.workout_plan.result, (p) =>
          ((p.days as { exercises?: { exerciseSlug: string }[] }[]) ?? []).flatMap((d) => (d.exercises ?? []).map((e) => e.exerciseSlug)));
        const recipeSlugs = slugsOf(jobs.nutrition_plan.result, (p) =>
          ((p.days as { meals?: { recipeSlug: string }[] }[]) ?? []).flatMap((d) => (d.meals ?? []).map((m) => m.recipeSlug)));
        const [{ exerciseNames, recipes }, profile] = await Promise.all([
          fetchCatalogNames([...new Set(exerciseSlugs)], [...new Set(recipeSlugs)]),
          supabase.from('profiles').select('sex,birth_date,height_cm,weight_kg,experience,onboarding').eq('user_id', user.id).maybeSingle(),
        ]);

        let targets: PlanData['targets'] = null;
        let preferredDays: Weekday[] = [];
        if (profile.data) {
          try {
            targets = buildPlanInputs(profile.data as never).targets;
          } catch {
            targets = null;
          }
          const pd = (profile.data.onboarding as { preferredDays?: Weekday[] } | null)?.preferredDays;
          if (Array.isArray(pd)) preferredDays = pd;
        }
        if (active) setState({ status: 'ready', data: { workoutResult: jobs.workout_plan.result, nutritionResult: jobs.nutrition_plan.result, exerciseNames, recipes, preferredDays, targets } });
      } catch {
        if (active) setState({ status: 'error' });
      }
    })();
    return () => {
      active = false;
    };
  }, [user, version]);

  const value = useMemo(() => ({ state, reload }), [state, reload]);
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}
