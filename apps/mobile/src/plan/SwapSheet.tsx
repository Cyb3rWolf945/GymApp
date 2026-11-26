import { useEffect, useState } from 'react';
import { WorkoutPlanSchema } from '@gymapp/shared';
import { useAuth } from '../auth/AuthProvider';
import { en } from '../copy/en';
import type { PlanData } from '../home/usePlanData';
import { BottomSheet, Button, InlineSkeleton, Text, useToast } from '../ui';
import { type SwapOption, fetchSwapOptions, recordSwap } from './api';

const s = en.home.swap;

export interface SwapTarget {
  dayIndex: number;
  slug: string;
  name: string;
}

interface Props {
  target: SwapTarget | null;
  data: PlanData;
  onClose: () => void;
  /** Called after the swap is saved, so the plan can reload. */
  onSwapped: (toSlug: string) => void;
}

/** "Swap exercise": deterministic alternatives from the library (same muscles, your equipment, no clashes with injuries). No LLM. */
export function SwapSheet({ target, data, onClose, onSwapped }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const [options, setOptions] = useState<SwapOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    let active = true;
    setOptions(null);
    setError(null);
    // Don't offer what is already in that day.
    const parsed = WorkoutPlanSchema.safeParse((data.workoutResult as { plan?: unknown } | null)?.plan);
    const inDay = parsed.success ? (parsed.data.days[target.dayIndex]?.exercises.map((e) => e.exerciseSlug) ?? []) : [];
    fetchSwapOptions(target.slug, data.swapProfile, inDay).then(
      (o) => active && setOptions(o),
      () => active && setError(s.loadError),
    );
    return () => {
      active = false;
    };
  }, [target, data]);

  const choose = async (o: SwapOption) => {
    if (!user || !target) return;
    setSaving(true);
    const ok = await recordSwap(user.id, data.workoutJobId, target.dayIndex, target.slug, o.slug);
    setSaving(false);
    if (!ok) return setError(s.saveError);
    toast.show(s.done(o.name), 'success');
    onSwapped(o.slug);
  };

  return (
    <BottomSheet visible={!!target} onClose={onClose} title={target ? s.title(target.name) : undefined} closeLabel={en.common.close}>
      <Text tone="muted">{s.body}</Text>
      {error ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
      {!options && !error ? <InlineSkeleton lines={3} label={en.common.loading} /> : null}
      {options && options.length === 0 ? <Text>{s.none}</Text> : null}
      {options?.map((o) => (
        <Button key={o.slug} label={s.pick(o.name)} variant="secondary" loading={saving} onPress={() => void choose(o)} />
      ))}
    </BottomSheet>
  );
}
