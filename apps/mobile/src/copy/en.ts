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
    progress: (step: number, total: number) => `Step ${step} of ${total}`,
    building: 'Building your plan…',
    haveAccount: 'I have an account',
    errors: {
      pickOne: 'Pick an option to continue.',
      pickAtLeastOne: 'Pick at least one option to continue.',
      needConsents: 'Accept all four to continue. We need them to build your plan.',
      saveProfile: "Couldn't save your answers. Check your connection and try again.",
    },
    steps: {
      welcome: { title: "Let's build your plan.", body: 'A few quick questions. It takes about 3 minutes.', cta: 'Get started' },
      goal: {
        title: "What's your main goal?",
        options: { cut: 'Lose fat', bulk: 'Build muscle', recomp: 'Get leaner and stronger' },
      },
      basics: {
        title: 'The basics',
        body: 'We use these to set your calories and protein.',
        sex: { male: 'Male', female: 'Female' },
        units: { metric: 'Metric', imperial: 'Imperial' },
        age: 'Age',
        height: 'Height',
        weight: 'Weight',
      },
      target: {
        title: 'Any target weight in mind?',
        body: 'Optional. You can change it later.',
        targetLabel: 'Target weight',
        paceLabel: 'How fast?',
        pace: { slow: 'Slow and steady', moderate: 'Moderate', aggressive: 'Fast' },
        skip: 'Skip this',
      },
      experience: {
        title: 'How long have you been lifting?',
        options: { beginner: 'New to it', intermediate: '1 to 3 years', advanced: '3+ years' },
        liftsTitle: 'Know your lifts? Add them (optional).',
        squat: 'Squat',
        bench: 'Bench press',
        deadlift: 'Deadlift',
        notSet: 'Not set',
      },
      availability: {
        title: 'When can you train?',
        days: 'Days per week',
        minutes: 'Minutes per workout',
        preferred: 'Preferred days (optional)',
        weekdays: { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' },
      },
      equipment: {
        title: 'Where do you train?',
        location: { gym: 'Gym', home: 'Home', outdoors: 'Outdoors' },
        equipmentTitle: 'What can you use?',
        equipment: {
          full_gym: 'Full gym', basic_gym: 'Basic gym', dumbbells: 'Dumbbells', barbell: 'Barbell',
          kettlebell: 'Kettlebell', bands: 'Bands', bodyweight: 'Bodyweight only',
        },
      },
      injuries: {
        title: "Got it. We'll protect that knee.",
        body: 'Tap anything that hurts or needs care.',
        zones: { knee: 'Knee', shoulder: 'Shoulder', lower_back: 'Lower back', elbow: 'Elbow', wrist: 'Wrist', hip: 'Hip', neck: 'Neck' },
        notePlaceholder: 'Anything else we should know? Keep it short.',
        noteLimit: (n: number) => `${n} of 280 characters`,
        skip: 'Nothing hurts',
      },
      activity: {
        title: 'How active is your day, outside workouts?',
        options: {
          sedentary: 'Mostly sitting',
          light: 'Light, some walking',
          moderate: 'On my feet a fair bit',
          active: 'Very active',
          very_active: 'Physical job or sport',
        },
      },
      diet: {
        title: 'How do you like to eat?',
        diet: { omnivore: 'I eat everything', vegetarian: 'Vegetarian', vegan: 'Vegan' },
        meals: 'Meals per day',
      },
      allergies: {
        title: 'Any allergies or foods to skip?',
        body: "Allergies are a hard rule. We'll never put them in your plan.",
        allergensTitle: 'Allergies',
        allergens: { gluten: 'Gluten', lactose: 'Lactose', nuts: 'Nuts', shellfish: 'Shellfish', egg: 'Egg', soy: 'Soy', fish: 'Fish' },
        dislikesTitle: "Foods you'd rather skip",
      },
      budget: {
        title: 'Budget and cooking time',
        body: 'Optional. It helps us pick meals that fit your week.',
        budgetTitle: 'Food budget',
        budget: { low: 'Tight', medium: 'Moderate', high: 'Flexible' },
        cookingTitle: 'Cooking time per meal',
        cookingMinutes: (m: number) => `${m} min`,
        skip: 'Skip this',
      },
      consents: {
        title: 'Last step',
        body: 'We need your OK to build your plan.',
        terms: 'I accept the terms of use.',
        privacy: 'I accept the privacy policy.',
        healthData: 'I agree that Fuelift processes my health data to build my plan.',
        disclaimer: "I understand this isn't medical advice.",
        notifications: 'Remind me to train (optional).',
        cta: 'Create my account',
      },
    },
  },
  plan: {
    generating: {
      title: 'Building your plan…',
      steps: {
        calories: 'Calculating your calories…',
        exercises: 'Picking your exercises…',
        meals: 'Planning your meals…',
      },
      caloriesDone: (kcal: string) => `About ${kcal} kcal a day`,
      accountTitle: 'Create your account to see your plan.',
      accountBody: 'We save your answers to your account, so you never start over.',
      accountCta: 'Create my account',
      timeout: 'This is taking longer than usual. Try again.',
      retry: 'Try again',
    },
    preview: {
      title: 'Your plan is ready.',
      workoutTitle: 'Your first workout',
      mealsTitle: 'A day of meals',
      why: 'Why this plan',
      setsReps: (sets: number, reps: string) => `${sets} × ${reps}`,
      portions: (n: number) => (n === 1 ? '1 serving' : `${n} servings`),
      kcal: 'Calories',
      protein: 'Protein',
      carbs: 'Carbs',
      fat: 'Fat',
      cta: 'Continue',
      missing: 'Part of your plan is missing. Try again.',
    },
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
