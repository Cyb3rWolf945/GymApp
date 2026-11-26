import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { type GenerationProgress, type JobRow, deriveProgress, isComplete, isInFlight, latestJobs, missingProfileFields, pollDelayMs } from '@gymapp/shared';
import { useAuth } from '../auth/AuthProvider';
import { useOnboarding } from '../onboarding/OnboardingProvider';
import { saveProfileOnce } from '../onboarding/useSaveOnboarding';
import { START_KINDS, fetchJobs, fetchSavedProfile, startGeneration } from './api';

export type GenerationView =
  | { kind: 'starting' }
  | { kind: 'running'; progress: GenerationProgress }
  | { kind: 'done' }
  | { kind: 'needs_trial' }
  | { kind: 'error'; reason: 'profile' | 'incomplete' | 'generate' | 'timeout' };

/**
 * Starts the two plan jobs (workout + meals) if they are not already done or alive, then polls `generation_jobs` until
 * both are done, one failed (a job whose function died counts as failed once it is stale), or the timeout passes.
 * "Try again" starts new jobs: dead ones are never waited on.
 */
export function useGeneration(): { view: GenerationView; retry: () => void } {
  const { session } = useAuth();
  const { hydrated, answers, clear } = useOnboarding();
  const userId = session?.user.id;
  const [view, setView] = useState<GenerationView>({ kind: 'starting' });
  const [attempt, setAttempt] = useState(0);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const clearRef = useRef(clear);
  clearRef.current = clear;
  // The 3-minute clock belongs to the attempt, not to the effect: if the effect runs again, the first start stands.
  const clock = useRef<{ attempt: number; at: number } | null>(null);

  useEffect(() => {
    if (!userId || !hydrated) return;
    if (clock.current?.attempt !== attempt) clock.current = { attempt, at: Date.now() };
    const startedAt = clock.current.at;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polling = false; // at most one poll at a time
    let polls = 0;
    setView({ kind: 'starting' });

    const fail = (reason: 'profile' | 'incomplete' | 'generate' | 'timeout') => active && setView({ kind: 'error', reason });

    const poll = async () => {
      if (polling || !active) return;
      polling = true;
      clearTimeout(timer);
      let rows: JobRow[];
      try {
        rows = await fetchJobs(userId);
      } catch {
        polling = false;
        return fail('generate');
      }
      polling = false;
      if (!active) return;
      const progress = deriveProgress(rows, startedAt, Date.now());
      // Done, failed or timed out: the loop ends here, for good.
      if (progress.phase === 'done') return setView({ kind: 'done' });
      if (progress.phase === 'failed') return fail('generate');
      if (progress.phase === 'timeout') return fail('timeout');
      setView({ kind: 'running', progress });
      timer = setTimeout(() => void poll(), pollDelayMs(polls++));
    };

    // Back in the app (or the tab visible again): look now instead of waiting out the gap.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && started) void poll();
    });
    let started = false;

    void (async () => {
      // The profile must exist, and be complete, before the function reads it: save, then read it back and check it.
      if (isComplete(answersRef.current)) {
        if (!(await saveProfileOnce(userId, answersRef.current))) return fail('profile');
        await clearRef.current();
      }
      let saved: Awaited<ReturnType<typeof fetchSavedProfile>>;
      try {
        saved = await fetchSavedProfile(userId);
      } catch {
        return fail('profile'); // could not read it: a real failure
      }
      // Incomplete with nothing to save from this device: the quiz is what's missing, not the connection.
      if (missingProfileFields(saved).length > 0) return fail(isComplete(answersRef.current) ? 'profile' : 'incomplete');
      if (!active) return;

      let existing: Partial<ReturnType<typeof latestJobs>>;
      try {
        existing = latestJobs(await fetchJobs(userId));
      } catch {
        return fail('generate');
      }
      const now = Date.now();
      for (const kind of START_KINDS) {
        const job = existing[kind];
        // A dead job (stuck "running" past the stale limit) is not waited on: a new one starts instead.
        if (job?.status === 'done' || isInFlight(job, now)) continue;
        const r = await startGeneration(kind);
        if (!active) return;
        if (r === 'needs_trial') return setView({ kind: 'needs_trial' });
        if (r === 'error') return fail('generate');
      }
      started = true;
      void poll();
    })();

    return () => {
      active = false;
      clearTimeout(timer);
      sub.remove();
    };
  }, [userId, hydrated, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { view, retry };
}
