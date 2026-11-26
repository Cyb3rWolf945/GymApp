import { factsDislikeRecipe, recipeDislikes } from './dislikes.ts';
import type { PlanInputs, RecipeCandidate } from './prompts.ts';
import type { NutritionPlan } from './schemas.ts';
import { MACRO_TOLERANCE, recipeProblems } from './validator.ts';

// E-66: the template meal plan, the fallback when the models fail or run out of time. Deterministic and personal:
// real meal slots, hard filters that are never relaxed (allergens, diet), soft filters that are relaxed in a fixed order,
// per-meal portions that land on the day's targets, and a rationale written from the inputs. No LLM.

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
/** The soft filters that were let go, in the order they are relaxed. */
export type RelaxedFilter = 'cooking_time' | 'budget' | 'swaps_memory' | 'dislikes' | 'meal_type' | 'variety';
/** `meal_type` is the very last resort: a slot may then borrow a recipe tagged for a neighbouring meal (a light lunch as a snack). */
export const RELAX_ORDER: readonly RelaxedFilter[] = ['cooking_time', 'budget', 'swaps_memory', 'dislikes', 'meal_type'];
const NEIGHBOURS: Record<MealType, readonly MealType[]> = { breakfast: ['snack'], snack: ['breakfast', 'lunch'], lunch: ['dinner', 'snack'], dinner: ['lunch'] };

/** Soft signals about this user. */
export interface TemplateContext {
  /** Breaks ties: the same seed always gives the same plan, other seeds (other users) give other ones. Use the user id. */
  seed?: string;
  /** Recipes the user swapped away from before (`meal_swaps.from_slug`). */
  avoidSlugs?: readonly string[];
  /** Active memory facts (`memory_facts.fact`): "does not like X" facts steer the template away from X. */
  facts?: readonly string[];
}

export interface MealTemplateResult {
  plan: NutritionPlan;
  /** Soft filters that had to be relaxed to fill every slot (empty: all applied). */
  relaxed: RelaxedFilter[];
}

/** Not enough recipes to fill the slots, even after relaxing every soft filter. Never because of an allergen or the diet. */
export class TemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateError';
  }
}

interface Slot {
  name: string;
  type: MealType;
  /** Share of the day's calories. */
  weight: number;
}

const BREAKFAST: Slot = { name: 'Breakfast', type: 'breakfast', weight: 0.25 };
const LUNCH: Slot = { name: 'Lunch', type: 'lunch', weight: 0.3 };
const DINNER: Slot = { name: 'Dinner', type: 'dinner', weight: 0.35 };
const snack = (name: string): Slot => ({ name, type: 'snack', weight: 0.1 });

/** Meal slots by meals per day: 3 = breakfast, lunch, dinner; 4 adds a snack, 5 two, 6 three. Slot names are the ones people see. */
export function mealSlots(mealsPerDay: number): Slot[] {
  const n = Math.min(6, Math.max(3, Math.round(mealsPerDay || 3)));
  const slots: Slot[] = [BREAKFAST];
  if (n >= 5) slots.push(snack('Morning snack'));
  slots.push(LUNCH);
  if (n >= 4) slots.push(snack('Afternoon snack'));
  slots.push(DINNER);
  if (n >= 6) slots.push(snack('Evening snack'));
  const total = slots.reduce((t, s) => t + s.weight, 0);
  return slots.map((s) => ({ ...s, weight: s.weight / total }));
}

const TIER = { low: 0, medium: 1, high: 2 } as const;
const round = (n: number, step: number) => Math.round(n / step) * step;
const PORTION_MIN = 0.5;
const PORTION_MAX = 3;
const PORTION_HARD_MAX = 4;
const COMBOS_PER_DAY = 400;
const TOP_PER_SLOT = 10;
/** Fewer than this many recipes for a slot and the next soft filter is relaxed. */
const MIN_POOL = 3;

/** Small seeded random numbers (mulberry32) from a text seed: no `Math.random`, so a re-run gives the same plan. */
function rngFrom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const typesOf = (r: RecipeCandidate): readonly string[] => (r.meal_types && r.meal_types.length > 0 ? r.meal_types : ['breakfast', 'lunch', 'dinner', 'snack']);

interface Totals { kcal: number; protein: number; carbs: number; fat: number }
const totalsOf = (picks: readonly RecipeCandidate[], portions: readonly number[]): Totals => {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  picks.forEach((r, i) => {
    t.kcal += (r.kcal ?? 0) * portions[i];
    t.protein += (r.protein_g ?? 0) * portions[i];
    t.carbs += (r.carbs_g ?? 0) * portions[i];
    t.fat += (r.fat_g ?? 0) * portions[i];
  });
  return t;
};

interface Want { kcal: number; proteinG: number; carbsG: number; fatG: number }
/** [how many targets are outside the validator's tolerance (calories weigh 3), squared relative error]. Lower is better, compared in that order. */
function scoreOf(t: Totals, w: Want, portions: readonly number[]): [number, number] {
  const e = (got: number, want: number) => (want > 0 ? (got - want) / want : 0);
  const errs = { kcal: e(t.kcal, w.kcal), protein: e(t.protein, w.proteinG), carbs: e(t.carbs, w.carbsG), fat: e(t.fat, w.fatG) };
  // Calories count three times: a plan far from the day's energy is worse than one a little off on a single macro.
  const out = [errs.protein, errs.carbs, errs.fat].filter((x) => Math.abs(x) > MACRO_TOLERANCE * 0.9).length + (Math.abs(errs.kcal) > MACRO_TOLERANCE * 0.9 ? 3 : 0);
  // Protein above the target matters less than below it; the rest are two-sided.
  const sq = errs.kcal ** 2 * 2 + (errs.protein < 0 ? errs.protein ** 2 * 2 : errs.protein ** 2 * 0.6) + errs.carbs ** 2 + errs.fat ** 2;
  const heavy = portions.reduce((s, p) => s + (p > 2.5 ? (p - 2.5) ** 2 : 0), 0) * 0.002;
  return [out, sq + heavy];
}
const better = (a: [number, number], b: [number, number]) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1] - 1e-12);

/**
 * Portions for a fixed set of recipes. Starts from `start` (or from each slot's calorie share) and nudges one meal at a time by
 * `step`, keeping every change that lands closer to the day's targets.
 */
function bestPortions(picks: readonly RecipeCandidate[], shares: readonly number[], want: Want, step = 0.5, start?: readonly number[], maxPortion = PORTION_MAX): { portions: number[]; score: [number, number] } {
  const portions = start
    ? [...start]
    : picks.map((r, i) => Math.min(PORTION_MAX, Math.max(PORTION_MIN, round((shares[i] * want.kcal) / Math.max(1, r.kcal ?? 1), step))));
  let score = scoreOf(totalsOf(picks, portions), want, portions);
  for (let pass = 0; pass < 30; pass++) {
    let improved = false;
    for (let i = 0; i < picks.length; i++) {
      for (const d of [-step, step]) {
        const p = portions[i] + d;
        if (p < PORTION_MIN - 1e-9 || p > maxPortion + 1e-9) continue;
        const next = [...portions];
        next[i] = p;
        const sc = scoreOf(totalsOf(picks, next), want, next);
        if (better(sc, score)) {
          portions[i] = p;
          score = sc;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return { portions, score };
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const WORDS: Record<number, string> = { 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six' };
const ALLERGEN_LABEL: Record<string, string> = { nuts: 'nuts', gluten: 'gluten', lactose: 'lactose', shellfish: 'shellfish', egg: 'eggs', soy: 'soy', fish: 'fish' };

/** "Four meals a day around 2,300 kcal and 140 g protein on training days, vegetarian, no nuts, 30 minutes or less to cook." */
export function templateRationale(inputs: PlanInputs, relaxed: readonly RelaxedFilter[], mealsPerDay: number): string {
  const day = inputs.targets.training;
  const bits = [`${WORDS[Math.min(6, Math.max(3, mealsPerDay))]} meals a day around ${fmt(round(day.kcal, 50))} kcal and ${fmt(round(day.proteinG, 5))} g protein on ${inputs.daysPerWeek >= 7 ? 'every day' : 'training days'}`];
  if (inputs.diet !== 'omnivore') bits.push(inputs.diet);
  if (inputs.allergens.length > 0) bits.push(inputs.allergens.map((a) => `no ${ALLERGEN_LABEL[a] ?? a}`).join(', '));
  const dislikes = inputs.dislikes ?? [];
  if (dislikes.length > 0 && !relaxed.includes('dislikes')) bits.push(`skipping ${dislikes.join(', ')}`);
  if (inputs.cookingMinutes && !relaxed.includes('cooking_time')) bits.push(`${inputs.cookingMinutes} minutes or less to cook`);
  if (inputs.budget === 'low' && !relaxed.includes('budget')) bits.push('on a tight budget');
  let text = `${bits.join(', ')}.`;
  if (relaxed.length > 0) text += ` We could not fit every preference (${relaxed.map((r) => r.replace('_', ' ').replace('swaps memory', 'earlier swaps').replace('meal type', 'meal types')).join(', ')}), so some meals are looser matches.`;
  return `${text} Swap any meal you like less.`;
}

/**
 * Builds the plan. Hard filters (allergens, diet) are always applied; soft filters (cooking time, budget, earlier swaps and
 * remembered dislikes, dislikes) are applied too, then relaxed in that order only as far as needed to have a few recipes per slot.
 * Throws `TemplateError` if a slot still has none, or the slots cannot be filled with different recipes.
 */
export function buildNutritionTemplate(inputs: PlanInputs, library: readonly RecipeCandidate[], ctx: TemplateContext = {}): MealTemplateResult {
  const slots = mealSlots(inputs.mealsPerDay ?? 3);
  const safe = library.filter((r) => (r.kcal ?? 0) > 0 && recipeProblems(r, inputs).length === 0);
  const avoid = new Set(ctx.avoidSlugs ?? []);
  const dislikes = inputs.dislikes ?? [];

  const fits = (r: RecipeCandidate, off: ReadonlySet<RelaxedFilter>): boolean => {
    if (!off.has('cooking_time') && inputs.cookingMinutes && (r.prep_minutes ?? 0) > inputs.cookingMinutes) return false;
    if (!off.has('budget') && inputs.budget && TIER[(r.cost_tier ?? 'medium') as keyof typeof TIER] > TIER[inputs.budget]) return false;
    if (!off.has('swaps_memory') && (avoid.has(r.slug) || factsDislikeRecipe(ctx.facts ?? [], r.ingredients ?? []))) return false;
    if (!off.has('dislikes') && recipeDislikes(r.ingredients ?? [], dislikes).length > 0) return false;
    return true;
  };
  const pools = (off: ReadonlySet<RelaxedFilter>) =>
    slots.map((s) => safe.filter((r) => (typesOf(r).includes(s.type) || (off.has('meal_type') && NEIGHBOURS[s.type].some((t) => typesOf(r).includes(t)))) && fits(r, off)));
  /** Every slot has a few recipes, and the slots of one meal type can be filled with different recipes. */
  const enough = (p: RecipeCandidate[][]) =>
    p.every((x) => x.length >= MIN_POOL) &&
    (['breakfast', 'lunch', 'dinner', 'snack'] as const).every((t) => {
      const idx = slots.map((s, i) => (s.type === t ? i : -1)).filter((i) => i >= 0);
      return idx.length <= 1 || new Set(idx.flatMap((i) => p[i].map((r) => r.slug))).size >= idx.length + 1;
    });

  const off = new Set<RelaxedFilter>();
  let pool = pools(off);
  for (const f of RELAX_ORDER) {
    if (enough(pool)) break;
    off.add(f);
    pool = pools(off);
  }
  if (pool.some((p) => p.length === 0)) throw new TemplateError('Not enough recipes for every meal slot.');
  const relaxed: RelaxedFilter[] = RELAX_ORDER.filter((f) => off.has(f));

  const rng = rngFrom(ctx.seed ?? 'template');
  const shares = slots.map((s) => s.weight);
  const dayTypes = (inputs.daysPerWeek >= 7 ? ['training'] : inputs.daysPerWeek <= 0 ? ['rest'] : ['training', 'rest']) as ('training' | 'rest')[];

  const used: string[][] = [];
  const days = dayTypes.map((dayType): NutritionPlan['days'][number] => {
    const t = inputs.targets[dayType];
    const want: Want = { kcal: t.kcal, proteinG: t.proteinG, carbsG: t.carbsG, fatG: t.fatG };
    // Per slot: the recipes closest to the slot's calories (at one portion) first, ties shuffled by the seed. The portions
    // fit the rest later, so nothing is ruled out here; only the top few are sampled, the rest are tried by the improvement step.
    const ranked = pool.map((p, i) => {
      const target = shares[i] * want.kcal;
      return p
        .map((r) => ({ r, k: Math.abs(Math.log(target / r.kcal!)) + rng() * 0.15 }))
        .sort((a, b) => a.k - b.k || a.r.slug.localeCompare(b.r.slug))
        .slice(0, Math.max(TOP_PER_SLOT, slots.length + 2))
        .map((x) => x.r);
    });
    const other = new Set(used[0] ?? []);
    // Training and rest days share at most one recipe.
    let enforce = true;
    const strictOverlap = (picks: readonly RecipeCandidate[], slot: number, candidate: RecipeCandidate) =>
      enforce && other.size > 0 && picks.filter((x, k) => other.has((k === slot ? candidate : x).slug)).length > 1;
    type Best = { picks: RecipeCandidate[]; portions: number[]; score: [number, number] };
    /** Swap one recipe at a time for any other that fits the slot, re-fit the portions, keep what is closer. */
    const improve = (start: Best): Best => {
      let cur = start;
      for (let round2 = 0; round2 < 6; round2++) {
        let changed = false;
        for (let i = 0; i < slots.length; i++) {
          for (const r of pool[i]) {
            if (cur.picks.includes(r) || strictOverlap(cur.picks, i, r)) continue;
            const picks: RecipeCandidate[] = cur.picks.map((x, k) => (k === i ? r : x));
            const res = bestPortions(picks, shares, want, 0.5, cur.portions);
            if (better(res.score, cur.score)) {
              cur = { picks, ...res };
              changed = true;
            }
          }
        }
        if (!changed) break;
      }
      return cur;
    };
    const search = (): Best | null => {
    let best = null as Best | null;
    // A few rounds: sample combinations (training and rest days share at most one recipe, when the library allows it),
    // improve the best of each round, and stop as soon as every macro is inside the validator's tolerance.
    for (let rounds = 0; rounds < 10 && (!best || best.score[0] > 0); rounds++) {
      let roundBest = null as Best | null;
      for (const strict of enforce ? [true, false] : [false]) {
        for (let n = 0; n < COMBOS_PER_DAY / 2; n++) {
          const picks: RecipeCandidate[] = [];
          let ok = true;
          for (let i = 0; i < slots.length && ok; i++) {
            const options = ranked[i].filter((r) => !picks.includes(r));
            if (options.length === 0) ok = false;
            else picks.push(options[Math.floor(rng() * options.length)]);
          }
          if (!ok) continue;
          if (strict && picks.filter((r) => other.has(r.slug)).length > 1) continue;
          const res = bestPortions(picks, shares, want);
          if (!roundBest || better(res.score, roundBest.score)) roundBest = { picks, ...res };
        }
        if (roundBest) break;
      }
      if (!roundBest) break;
      let cand = improve(roundBest);
      if (cand.score[0] > 0) {
        // Last resort: quarter steps, and up to 4 portions (the plan schema's limit) when 3 cannot reach the calories.
        const fine = bestPortions(cand.picks, shares, want, 0.25, cand.portions, PORTION_HARD_MAX);
        if (better(fine.score, cand.score)) cand = { picks: cand.picks, ...fine };
      }
      if (!best || better(cand.score, best.score)) best = cand;
    }
    return best;
    };
    enforce = true;
    let best = search();
    // Training and rest days share at most one recipe. A very small library (strict diet, allergens and dislikes together) can
    // make that impossible without missing the day's targets: then the targets win, and the plan says so.
    if (other.size > 0 && (!best || best.score[0] > 0)) {
      enforce = false;
      const loose = search();
      if (loose && (!best || loose.score[0] < best.score[0])) {
        best = loose;
        if (!relaxed.includes('variety')) relaxed.push('variety');
      }
    }
    if (!best) throw new TemplateError('Not enough different recipes to fill every meal slot.');
    used.push(best.picks.map((r) => r.slug));
    const totals = totalsOf(best.picks, best.portions);
    return {
      dayType,
      meals: best.picks.map((r, i) => ({ name: slots[i].name, recipeSlug: r.slug, portions: best.portions[i] })),
      kcal: Math.max(800, Math.round(totals.kcal)),
      proteinG: Math.round(totals.protein),
      carbsG: Math.round(totals.carbs),
      fatG: Math.round(totals.fat),
    };
  });
  return { plan: { days, rationale: templateRationale(inputs, relaxed, slots.length) }, relaxed };
}
