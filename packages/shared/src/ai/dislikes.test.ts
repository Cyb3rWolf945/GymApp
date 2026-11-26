import { describe, expect, it } from 'vitest';
import { DISLIKE_OPTIONS } from '../onboarding/schema';
import { factsDislikeRecipe, recipeDislikes } from './dislikes';

describe('recipeDislikes', () => {
  it('matches each listed dislike through ingredient names', () => {
    expect(recipeDislikes(['White mushroom', 'Rice'], ['mushrooms'])).toEqual(['mushrooms']);
    expect(recipeDislikes(['Atlantic salmon, raw'], ['fish'])).toEqual(['fish']);
    expect(recipeDislikes(['Canned tuna in water', 'Cod, raw', 'Tilapia, raw', 'Canned sardines in oil'], ['fish'])).toEqual(['fish']);
    expect(recipeDislikes(['Firm tofu'], ['tofu'])).toEqual(['tofu']);
    expect(recipeDislikes(['Red onion', 'Spring onions'], ['onion'])).toEqual(['onion']);
    expect(recipeDislikes(['Eggplant'], ['eggplant'])).toEqual(['eggplant']);
    expect(recipeDislikes(['Aubergine'], ['eggplant'])).toEqual(['eggplant']);
    expect(recipeDislikes(['Chili powder'], ['spicy food'])).toEqual(['spicy food']);
    expect(recipeDislikes(['Fresh coriander'], ['cilantro'])).toEqual(['cilantro']);
    expect(recipeDislikes(['Chicken liver'], ['liver'])).toEqual(['liver']);
    expect(recipeDislikes(['Broccoli'], ['broccoli'])).toEqual(['broccoli']);
  });
  it('does not confuse near neighbours', () => {
    expect(recipeDislikes(['Extra virgin olive oil'], ['olives'])).toEqual([]); // olive oil is not olives
    expect(recipeDislikes(['Green olives'], ['olives'])).toEqual(['olives']);
    expect(recipeDislikes(['Shrimp, raw'], ['fish'])).toEqual([]); // shellfish is not fish
    expect(recipeDislikes(['Black pepper', 'Red bell pepper'], ['spicy food'])).toEqual([]);
    expect(recipeDislikes(['Broccoli'], ['onion', 'fish'])).toEqual([]);
  });
  it('only looks at the dislikes it is given, ignores unknown ones, and lists each once', () => {
    expect(recipeDislikes(['Onion', 'Firm tofu'], [])).toEqual([]);
    expect(recipeDislikes(['Onion'], ['pineapple'])).toEqual([]);
    expect(recipeDislikes(['Onion', 'Onion'], ['onion', 'onion'])).toEqual(['onion']);
  });
  it('every dislike option has a pattern', () => {
    for (const d of DISLIKE_OPTIONS) expect(recipeDislikes([], [d])).toEqual([]);
    expect(DISLIKE_OPTIONS.every((d) => recipeDislikes([`${d} special`], [d]).length === 1 || ['olives', 'spicy food', 'cilantro', 'eggplant', 'liver', 'tofu', 'fish', 'onion', 'mushrooms', 'broccoli'].includes(d))).toBe(true);
  });
});

describe('factsDislikeRecipe (memory facts)', () => {
  const ingredients = ['Atlantic salmon, raw', 'Quinoa, cooked', 'Asparagus'];
  it('catches a remembered "does not like X" that names an ingredient', () => {
    expect(factsDislikeRecipe(['Does not like salmon.'], ingredients)).toBe(true);
    expect(factsDislikeRecipe(['Hates asparagus'], ingredients)).toBe(true);
    expect(factsDislikeRecipe(["Doesn't like quinoa"], ingredients)).toBe(true);
  });
  it('ignores facts that are not a dislike, or about other food', () => {
    expect(factsDislikeRecipe(['Loves salmon'], ingredients)).toBe(false);
    expect(factsDislikeRecipe(['Trains early in the morning'], ingredients)).toBe(false);
    expect(factsDislikeRecipe(['Does not like mushrooms'], ingredients)).toBe(false);
    expect(factsDislikeRecipe([], ingredients)).toBe(false);
    expect(factsDislikeRecipe(['Does not like raw cooked fresh'], ingredients)).toBe(false); // filler words are not food
  });
});
