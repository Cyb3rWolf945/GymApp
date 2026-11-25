import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  type Macros, type RecipeCandidate, type SwapRow, type Weekday, WorkoutPlanSchema, applySwaps, buildPlanInputs, latestJobs,
} from '@gymapp/shared';
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
  /** The workout job the plan comes from (swaps are recorded against it). */
  workoutJobId: string;
  /** What the swap candidates must respect. */
  swapProfile: { equipment: string[]; contraindications: string[]; level: string };
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

        // The user's swaps go on top of the generated plan.
        const { data: swapRows } = await supabase.from('plan_swaps').select('day_index,from_slug,to_slug,created_at').eq('job_id', jobs.workout_plan.id);
        const parsedPlan = WorkoutPlanSchema.safeParse((jobs.workout_plan.result as { plan?: unknown } | null)?.plan);
        const workoutResult = parsedPlan.success
          ? { ...(jobs.workout_plan.result as object), plan: applySwaps(parsedPlan.data, (swapRows ?? []) as SwapRow[]) }
          : jobs.workout_plan.result;

        const exerciseSlugs = slugsOf(workoutResult, (p) =>
          ((p.days as { exercises?: { exerciseSlug: string }[] }[]) ?? []).flatMap((d) => (d.exercises ?? []).map((e) => e.exerciseSlug)));
        const recipeSlugs = slugsOf(jobs.nutrition_plan.result, (p) =>
          ((p.days as { meals?: { recipeSlug: string }[] }[]) ?? []).flatMap((d) => (d.meals ?? []).map((m) => m.recipeSlug)));
        const [{ exerciseNames, recipes }, profile] = await Promise.all([
          fetchCatalogNames([...new Set(exerciseSlugs)], [...new Set(recipeSlugs)]),
          supabase.from('profiles').select('sex,birth_date,height_cm,weight_kg,experience,onboarding').eq('user_id', user.id).maybeSingle(),
        ]);

        let targets: PlanData['targets'] = null;
        let preferredDays: Weekday[] = [];
        const swapProfile: PlanData['swapProfile'] = { equipment: ['bodyweight'], contraindications: [], level: 'beginner' };
        if (profile.data) {
          try {
            targets = buildPlanInputs(profile.data as never).targets;
          } catch {
            targets = null;
          }
          const ob = (profile.data.onboarding ?? {}) as { preferredDays?: Weekday[]; equipment?: string[]; contraindications?: string[] };
          if (Array.isArray(ob.preferredDays)) preferredDays = ob.preferredDays;
          if (Array.isArray(ob.equipment) && ob.equipment.length) swapProfile.equipment = ob.equipment;
          if (Array.isArray(ob.contraindications)) swapProfile.contraindications = ob.contraindications;
          if (profile.data.experience) swapProfile.level = profile.data.experience as string;
        }
        if (active) setState({ status: 'ready', data: { workoutResult, nutritionResult: jobs.nutrition_plan.result, exerciseNames, recipes, preferredDays, targets, workoutJobId: jobs.workout_plan.id, swapProfile } });
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
