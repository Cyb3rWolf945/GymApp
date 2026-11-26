import { DISLIKE_OPTIONS } from '../onboarding/schema.ts';

// E-66: foods a person would rather skip ("dislikes" in onboarding) matched to recipes through their ingredient names.
// Pure and deterministic. A dislike is a soft preference (allergens are the hard rule and never go through here).

export type Dislike = (typeof DISLIKE_OPTIONS)[number];

/** Ingredient-name patterns per dislike. Olive oil is not olives, and a mushroom is not a "mushrooms" dislike only by plural. */
export const DISLIKE_PATTERNS: Record<Dislike, readonly RegExp[]> = {
  mushrooms: [/\bmushrooms?\b/i],
  olives: [/\bolives?\b(?!\s+oil)/i],
  fish: [/\b(salmon|tuna|cod|sardines?|tilapia|trout|haddock|anchovies|anchovy|mackerel|fish)\b/i],
  liver: [/\bliver\b/i],
  tofu: [/\btofu\b/i],
  broccoli: [/\bbroccoli\b/i],
  onion: [/\b(onions?|shallots?|scallions?|spring onions?|leeks?)\b/i],
  cilantro: [/\b(cilantro|coriander)\b/i],
  'spicy food': [/\b(chil[il]|jalape[nñ]o|cayenne|sriracha|hot sauce|harissa|tabasco|chipotle)\b/i],
  eggplant: [/\b(eggplants?|aubergines?)\b/i],
};

/** Which of the listed dislikes a recipe breaks, judged by its ingredient names. */
export function recipeDislikes(ingredientNames: readonly string[], dislikes: readonly string[]): Dislike[] {
  const out: Dislike[] = [];
  for (const d of dislikes) {
    const patterns = DISLIKE_PATTERNS[d as Dislike];
    if (!patterns || out.includes(d as Dislike)) continue;
    if (ingredientNames.some((n) => patterns.some((p) => p.test(n)))) out.push(d as Dislike);
  }
  return out;
}

const NEGATIVE = /\b(dislikes?|doesn'?t like|does not like|don'?t like|hates?|can'?t stand|avoids?|won'?t eat|never eats?)\b/i;
const STOP = new Set(['raw', 'cooked', 'fresh', 'canned', 'dry', 'whole', 'extra', 'virgin', 'lean', 'ground', 'sauce', 'powder', 'in', 'water', 'oil', 'and', 'the', 'with']);

/**
 * A remembered "does not like X" fact (`memory_facts`) that names one of the recipe's ingredients. Rough on purpose:
 * it only has to steer the template away from food the person said they dislike.
 */
export function factsDislikeRecipe(facts: readonly string[], ingredientNames: readonly string[]): boolean {
  const words = new Set(
    ingredientNames
      .flatMap((n) => n.toLowerCase().split(/[^a-z]+/))
      .filter((w) => w.length >= 4 && !STOP.has(w))
      .map((w) => w.replace(/s$/, '')),
  );
  return facts.some((f) => NEGATIVE.test(f) && f.toLowerCase().split(/[^a-z]+/).some((w) => w.length >= 4 && words.has(w.replace(/s$/, ''))));
}
