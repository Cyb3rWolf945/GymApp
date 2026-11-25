import { authCopy } from '../auth/copy';

// All user-facing copy, keyed by screen. Follows docs/SPEC.md → "Guia de escrita":
// EN, 2nd person, short sentences, verb-first sentence-case buttons, no guilt words,
// errors say what happened + what to do. Use the glossary terms below, always.

/** Fixed terms. Use the left side everywhere; never the right side. */
export const glossary = {
  workout: { avoid: ['session', 'routine'] },
  plan: { avoid: ['program', 'programme'] },
  meal: { avoid: ['cheat meal'] },
} as const;

export const en = {
  common: {
    cancel: 'Cancel',
    save: 'Save changes',
    continue: 'Continue',
    back: 'Go back',
    skip: 'Skip for now',
    done: 'Finish',
    retry: 'Try again',
    close: 'Close',
    loading: 'Loading…',
  },
  auth: authCopy,
  onboarding: {
    goalTitle: "What's your main goal?",
    goalCta: 'Build my plan',
    injuriesTitle: "Got it. We'll protect that knee.",
    injuriesPlaceholder: 'Anything we should know? Keep it short.',
    injuriesLimit: 'Up to 280 characters.',
    daysTitle: 'How many days can you train?',
    progress: (step: number, total: number) => `Step ${step} of ${total}`,
    building: 'Building your plan…',
  },
  home: {
    title: 'Today',
    startWorkout: 'Start workout',
    emptyTitle: 'No workouts yet.',
    emptyBody: 'Your first one takes 40 min.',
    emptyCta: 'Build my plan',
  },
  workout: {
    logSet: 'Log set',
    finish: 'Finish workout',
    swap: 'Swap exercise',
    setProgress: (n: number, total: number) => `Set ${n} of ${total}`,
    rest: (mm: string) => `Rest ${mm}`,
    rpeHint: 'RPE is how hard a set feels, from 1 (easy) to 10 (max effort).',
  },
  nutrition: {
    title: 'Meals',
    swapMeal: 'Swap meal',
    emptyTitle: 'No meal plan yet.',
    emptyBody: 'Build your plan to see today’s meals.',
    shoppingList: 'Open shopping list',
  },
  health: {
    disclaimer: "This isn't medical advice. Talk to a doctor if you're pregnant or have a health condition.",
    conservativeNote: "We kept this plan gentle. Check with a doctor or a registered dietitian before you start.",
  },
  paywall: {
    title: 'Unlock your full plan',
    body: 'Unlock your full meal plan and weekly adjustments.',
    cta: 'Start free trial',
    restore: 'Restore purchase',
  },
  toasts: {
    saved: 'Saved.',
    setLogged: 'Set logged.',
    planReady: 'Your plan is ready.',
  },
  errors: {
    network: "Couldn't reach the server. Check your connection and try again.",
    saveSet: "Couldn't save your set. Check your connection and try again.",
    generatePlan: "Couldn't build your plan. Try again in a minute.",
    unknown: 'Something went wrong. Try again.',
  },
} as const;

export type Copy = typeof en;
