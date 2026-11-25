// App Store and Google Play listing text (ASO). EN, 2nd person, honest: no medical claims, no guaranteed results, no
// guilt language. The limits are the stores' own; a test keeps every field inside them. Print it for copy-paste with
// `pnpm tsx scripts/print-listing.ts`.

export const LIMITS = {
  apple: { name: 30, subtitle: 30, keywords: 100, promotionalText: 170, description: 4000 },
  google: { title: 30, shortDescription: 80, fullDescription: 4000 },
} as const;

/** Terms people search for. These three are the ones the issue asks us to own. */
export const TARGET_KEYWORDS = ['AI workout planner', 'meal plan', 'macro'] as const;

const DESCRIPTION = `Workouts and meals in one plan. It adapts every week.

Answer a few questions about your goal, your gear, your food and any injuries. Fuelift builds a training plan and a meal plan around you, and you can see it before you pay.

WORKOUTS
• A weekly plan from a curated exercise library, matched to the equipment you have
• Swap any exercise for one that works the same muscles and respects your injuries
• Log sets with a rest timer, spot your personal records and follow your strength trend
• A muscle map shows what you trained this week

MEALS
• Daily calories and protein, fat and carb targets worked out for you, with different targets for training and rest days
• Recipes with ingredient quantities, steps and allergen labels
• Swap a meal for another with about the same calories that fits your diet and allergies
• A weekly shopping list you can tick off

BUILT AROUND YOU
• Vegetarian and vegan plans, and allergies are a hard rule: they never end up in your plan
• Your data stays yours. Export it or delete your account in Settings at any time

Fuelift gives general fitness and nutrition guidance. It isn't medical advice. Talk to a doctor before you start if you're pregnant, injured or have a health condition.`;

export const LISTING = {
  apple: {
    name: 'Fuelift: AI Workout & Meals',
    subtitle: 'Workout planner, meals, macros',
    // Comma separated, no spaces after commas, not repeating words from the name or subtitle.
    keywords: 'AI workout planner,meal plan,macro,calorie,strength,gym log,diet,nutrition,fitness,recipes,protein',
    promotionalText: 'Answer a few questions and get a workout plan and a meal plan built for you. See it before you pay. It adapts as you log your workouts.',
    description: DESCRIPTION,
    category: { primary: 'Health & Fitness', secondary: 'Food & Drink' },
    ageRating: '12+ (infrequent mild references to nutrition and weight loss; no user-generated content)',
  },
  google: {
    title: 'Fuelift: AI Workout & Meals',
    shortDescription: 'AI workout and meal plan in one. Adapts every week. See it before you pay.',
    fullDescription: DESCRIPTION,
    category: 'Health & Fitness',
    tags: ['Fitness', 'Workout', 'Nutrition', 'Diet'],
  },
} as const;

/** Every text field with its limit, for the test and the print script. */
export function listingFields(): { store: 'apple' | 'google'; field: string; text: string; limit: number }[] {
  const a = LISTING.apple;
  const g = LISTING.google;
  return [
    { store: 'apple', field: 'name', text: a.name, limit: LIMITS.apple.name },
    { store: 'apple', field: 'subtitle', text: a.subtitle, limit: LIMITS.apple.subtitle },
    { store: 'apple', field: 'keywords', text: a.keywords, limit: LIMITS.apple.keywords },
    { store: 'apple', field: 'promotionalText', text: a.promotionalText, limit: LIMITS.apple.promotionalText },
    { store: 'apple', field: 'description', text: a.description, limit: LIMITS.apple.description },
    { store: 'google', field: 'title', text: g.title, limit: LIMITS.google.title },
    { store: 'google', field: 'shortDescription', text: g.shortDescription, limit: LIMITS.google.shortDescription },
    { store: 'google', field: 'fullDescription', text: g.fullDescription, limit: LIMITS.google.fullDescription },
  ];
}
