import { useCallback, useEffect, useRef, useState } from 'react';
import { type GenerationProgress, type JobRow, POLL_INTERVAL_MS, deriveProgress, isComplete, isInFlight, latestJobs } from '@gymapp/shared';
import { useAuth } from '../auth/AuthProvider';
import { useOnboarding } from '../onboarding/OnboardingProvider';
import { saveProfileOnce } from '../onboarding/useSaveOnboarding';
import { START_KINDS, fetchJobs, startGeneration } from './api';

export type GenerationView =
  | { kind: 'starting' }
  | { kind: 'running'; progress: GenerationProgress }
  | { kind: 'done' }
  | { kind: 'needs_trial' }
  | { kind: 'error'; reason: 'profile' | 'generate' | 'timeout' };

/**
 * Starts the two plan jobs (workout + meals) if they are not already done or running, then polls
 * `generation_jobs` until both are done, one failed, or the timeout passes.
 */
export function useGeneration(): { view: GenerationView; retry: () => void } {
  const { session } = useAuth();
  const { hydrated, answers, clear } = useOnboarding();
  const userId = session?.user.id;
  const [view, setView] = useState<GenerationView>({ kind: 'starting' });
  const [attempt, setAttempt] = useState(0);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  useEffect(() => {
    if (!userId || !hydrated) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    setView({ kind: 'starting' });

    const fail = (reason: 'profile' | 'generate' | 'timeout') => active && setView({ kind: 'error', reason });

    const poll = async () => {
      let rows: JobRow[];
      try {
        rows = await fetchJobs(userId);
      } catch {
        return fail('generate');
      }
      if (!active) return;
      const progress = deriveProgress(rows, startedAt, Date.now());
      if (progress.phase === 'done') return setView({ kind: 'done' });
      if (progress.phase === 'failed') return fail('generate');
      if (progress.phase === 'timeout') return fail('timeout');
      setView({ kind: 'running', progress });
      timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
    };

    void (async () => {
      // The profile must exist before the function can read it.
      if (isComplete(answersRef.current)) {
        if (!(await saveProfileOnce(userId, answersRef.current))) return fail('profile');
        await clear();
      }
      let existing: Partial<ReturnType<typeof latestJobs>>;
      try {
        existing = latestJobs(await fetchJobs(userId));
      } catch {
        return fail('generate');
      }
      for (const kind of START_KINDS) {
        const job = existing[kind];
        if (job?.status === 'done' || isInFlight(job)) continue;
        const r = await startGeneration(kind);
        if (!active) return;
        if (r === 'needs_trial') return setView({ kind: 'needs_trial' });
        if (r === 'error') return fail('generate');
      }
      void poll();
    })();

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [userId, hydrated, attempt, clear]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { view, retry };
}
