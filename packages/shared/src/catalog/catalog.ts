// Catalog vocabularies shared by the seed, the migrations' CHECK constraints and the app.
// Keep in sync with supabase/migrations/20261124000003_catalog_fields.sql.

/** Stable muscle IDs; these match the 3D Body Map mesh names (SPEC: Body Map). */
export const MUSCLE_IDS = [
  'pectoralis_major', 'pectoralis_minor', 'serratus_anterior',
  'deltoid_anterior', 'deltoid_lateral', 'deltoid_posterior', 'trapezius', 'rhomboids',
  'latissimus_dorsi', 'erector_spinae', 'rectus_abdominis', 'obliques', 'transversus_abdominis',
  'biceps_brachii', 'brachialis', 'triceps_brachii', 'forearm_flexors', 'forearm_extensors',
  'quadriceps', 'hamstrings', 'gluteus_maximus', 'gluteus_medius', 'hip_adductors', 'hip_flexors',
  'gastrocnemius', 'soleus', 'tibialis_anterior', 'neck_flexors',
] as const;
export type MuscleId = (typeof MUSCLE_IDS)[number];

export const EQUIPMENT = [
  'full_gym', 'basic_gym', 'dumbbells', 'barbell', 'kettlebell', 'bands', 'bodyweight',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const EXERCISE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type ExerciseLevel = (typeof EXERCISE_LEVELS)[number];

export const CONTRAINDICATIONS = ['knee', 'shoulder', 'lower_back', 'elbow', 'wrist', 'hip', 'neck'] as const;
export type Contraindication = (typeof CONTRAINDICATIONS)[number];

export const ALLERGENS = ['gluten', 'lactose', 'nuts', 'shellfish', 'egg', 'soy', 'fish'] as const;
export type Allergen = (typeof ALLERGENS)[number];

export const INGREDIENT_CATEGORIES = [
  'produce', 'meat', 'fish_seafood', 'dairy', 'eggs', 'grains', 'legumes', 'plant_protein',
  'nuts_seeds', 'fats_oils', 'condiments', 'spices',
] as const;
export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

export const DIETS = ['omnivore', 'vegetarian', 'vegan'] as const;
export type Diet = (typeof DIETS)[number];

/**
 * Allergen flags of a recipe, derived from its ingredients: the union of their flags,
 * returned in ALLERGENS order. Recipes do not store flags, so this is the only source.
 */
export function deriveAllergens(ingredients: ReadonlyArray<{ allergens: readonly string[] }>): Allergen[] {
  const present = new Set(ingredients.flatMap((i) => i.allergens));
  return ALLERGENS.filter((a) => present.has(a));
}
