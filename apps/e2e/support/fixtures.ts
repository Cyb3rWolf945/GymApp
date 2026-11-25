// Synthetic data for the fake backend. No real user data, ever. Shapes follow the app's Zod schemas
// (WorkoutPlanSchema, NutritionPlanSchema) and the tables the app reads.

export const USER = { id: '00000000-0000-4000-8000-0000000000e2', email: 'e2e-user@example.test' };

export const EXERCISES = [
  { id: '10000000-0000-4000-8000-000000000001', slug: 'barbell-bench-press', name: 'Barbell bench press' },
  { id: '10000000-0000-4000-8000-000000000002', slug: 'standing-barbell-overhead-press', name: 'Standing barbell overhead press' },
  { id: '10000000-0000-4000-8000-000000000003', slug: 'barbell-back-squat', name: 'Barbell back squat' },
  { id: '10000000-0000-4000-8000-000000000004', slug: 'conventional-deadlift', name: 'Conventional deadlift' },
];

const ex = (exerciseSlug: string) => ({ exerciseSlug, sets: 3, repsMin: 8, repsMax: 10, rpe: 8, restSeconds: 60 });

export const WORKOUT_PLAN = {
  split: 'upper_lower',
  days: [
    { name: 'Upper body', exercises: [ex('barbell-bench-press'), ex('standing-barbell-overhead-press')] },
    { name: 'Lower body', exercises: [ex('barbell-back-squat'), ex('conventional-deadlift')] },
  ],
  rationale: 'Two simple days that train every major muscle each week.',
};

const ingredient = (name: string, category: string, grams: number) => ({ grams, ingredients: { name, category, allergens: [] as string[] } });

export const RECIPES = [
  { slug: 'oats-and-berries', name: 'Oats and berries', diet: 'vegetarian', kcal: 520, protein_g: 28, carbs_g: 70, fat_g: 14, servings: 1, instructions: 'Mix.\nServe.', recipe_ingredients: [ingredient('Rolled oats', 'grains', 80), ingredient('Blueberries', 'produce', 100)] },
  { slug: 'chicken-rice-bowl', name: 'Chicken rice bowl', diet: 'omnivore', kcal: 680, protein_g: 52, carbs_g: 75, fat_g: 16, servings: 1, instructions: 'Cook.\nServe.', recipe_ingredients: [ingredient('Chicken breast', 'meat', 180), ingredient('Cooked rice', 'grains', 200)] },
  { slug: 'lentil-curry', name: 'Lentil curry', diet: 'vegan', kcal: 600, protein_g: 30, carbs_g: 80, fat_g: 15, servings: 1, instructions: 'Simmer.\nServe.', recipe_ingredients: [ingredient('Red lentils', 'legumes', 90), ingredient('Coconut milk', 'fats_oils', 80)] },
];

const meal = (name: string, recipeSlug: string) => ({ name, recipeSlug, portions: 1 });
const day = (dayType: 'training' | 'rest') => ({
  dayType,
  meals: [meal('Breakfast', 'oats-and-berries'), meal('Lunch', 'chicken-rice-bowl'), meal('Dinner', 'lentil-curry')],
  kcal: 1800,
  proteinG: 110,
  carbsG: 225,
  fatG: 45,
});

export const NUTRITION_PLAN = { days: [day('training'), day('rest')], rationale: 'Three meals a day that match your calories on training and rest days.' };

export const PLAN_PRICES = [
  ['basic_monthly', 'basic', 'month', 999], ['basic_annual', 'basic', 'year', 5999],
  ['pro_monthly', 'pro', 'month', 1999], ['pro_annual', 'pro', 'year', 11999],
  ['elite_monthly', 'elite', 'month', 2499], ['elite_annual', 'elite', 'year', 14999],
].map(([lookup_key, tier, interval, cents]) => ({ lookup_key, tier, interval, cents, variant: 'default', stripe_price_id: null, active: true }));

/** An unsigned JWT-shaped token that expires in 2100: enough for supabase-js, which only reads the claims. */
export function fakeSession(): Record<string, unknown> {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = 4_102_444_800;
  const access = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, email: USER.email, role: 'authenticated', aud: 'authenticated', exp })}.e2e-signature`;
  return {
    access_token: access,
    refresh_token: 'e2e-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: exp,
    user: { id: USER.id, email: USER.email, aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-11-23T09:00:00Z' },
  };
}

/** supabase-js keeps the session in localStorage under `sb-<first label of the host>-auth-token`. */
export const SESSION_STORAGE_KEY = 'sb-localhost-auth-token';
