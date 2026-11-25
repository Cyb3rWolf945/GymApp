import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ONBOARDING_VERSION, type PartialAnswers, type StepId, firstIncompleteStep } from '@gymapp/shared';
import { clearOnboarding, loadOnboarding, saveOnboarding } from './persist';

interface Ctx {
  /** False until the saved state has been read. */
  hydrated: boolean;
  answers: PartialAnswers;
  stepId: StepId;
  update: (patch: PartialAnswers) => void;
  setStepId: (id: StepId) => void;
  /** Where to resume: the saved step, or the first one still missing answers. */
  resumeStep: () => StepId;
  clear: () => Promise<void>;
}

const OnboardingContext = createContext<Ctx | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [answers, setAnswers] = useState<PartialAnswers>({});
  const [stepId, setStepIdState] = useState<StepId>('welcome');
  const cleared = useRef(false);

  useEffect(() => {
    let active = true;
    void loadOnboarding().then((saved) => {
      if (!active) return;
      if (saved && !cleared.current) {
        setAnswers(saved.answers);
        setStepIdState(saved.stepId);
      }
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // Persist locally on every change, until the account exists and the answers are saved to `profiles`.
  useEffect(() => {
    if (hydrated && !cleared.current) void saveOnboarding({ version: ONBOARDING_VERSION, stepId, answers });
  }, [hydrated, answers, stepId]);

  const update = useCallback((patch: PartialAnswers) => {
    cleared.current = false;
    setAnswers((a) => ({ ...a, ...patch }));
  }, []);
  const setStepId = useCallback((id: StepId) => {
    cleared.current = false;
    setStepIdState(id);
  }, []);
  const clear = useCallback(async () => {
    cleared.current = true;
    setAnswers({});
    setStepIdState('welcome');
    await clearOnboarding();
  }, []);
  const resumeStep = useCallback(
    () => (Object.keys(answers).length === 0 ? 'welcome' : (firstIncompleteStep(answers) ?? stepId)),
    [answers, stepId],
  );

  const value = useMemo(
    () => ({ hydrated, answers, stepId, update, setStepId, resumeStep, clear }),
    [hydrated, answers, stepId, update, setStepId, resumeStep, clear],
  );
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): Ctx {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used inside OnboardingProvider');
  return ctx;
}
