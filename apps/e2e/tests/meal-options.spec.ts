import { expect, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { button, shown, signedInWithPlan } from '../support/app';

const t = en.home;

/** A template meal plan (starter note and all), signed in, on Today (a Monday: a training day). */
async function today(page: import('@playwright/test').Page) {
  const backend = await signedInWithPlan(page);
  const nutrition = (backend.state.jobs as { kind: string; result: Record<string, unknown> }[]).find((j) => j.kind === 'nutrition_plan')!;
  nutrition.result = { ...nutrition.result, source: 'template' };
  await page.goto('/');
  await expect(shown(page, t.mealsTitle)).toBeVisible();
  return backend;
}

const optionCards = (page: import('@playwright/test').Page) => page.getByRole('button', { name: /^Use .*\. \d+ kcal/ }).filter({ visible: true });

test('each meal shows 2 or 3 other options, with kcal and protein; picking one changes the meal, the totals and the shopping list', async ({ page }) => {
  const backend = await today(page);
  await expect(shown(page, t.otherOptions)).toBeVisible();
  const first = optionCards(page);
  await expect.poll(() => first.count()).toBeGreaterThanOrEqual(2);
  expect(await first.count()).toBeLessThanOrEqual(9); // three meals, up to three options each
  await expect(page.getByText(/\d+ kcal · \d+ g protein/).filter({ visible: true }).first()).toBeVisible();

  // Breakfast options are breakfast recipes only.
  const breakfastOption = page.getByRole('button', { name: /^Use (Greek yogurt bowl|Eggs on toast|Protein pancakes)/ }).filter({ visible: true }).first();
  await expect(breakfastOption).toBeVisible();
  const name = (await breakfastOption.getAttribute('aria-label'))!.replace(/^Use /, '').split('. ')[0];
  await breakfastOption.click();

  // The card shows the new meal; a swap row was recorded against the plan.
  await expect(page.getByText(new RegExp(`${name} · \\d+ kcal`)).filter({ visible: true }).first()).toBeVisible();
  expect(backend.state.mealSwaps).toHaveLength(1);
  expect(backend.state.mealSwaps[0]).toMatchObject({ from_slug: 'oats-and-berries', day_index: 0, meal_index: 0 });
  await expect(shown(page, t.swappedTo(name))).toBeVisible();

  // The shopping list follows the new meal.
  await page.goto('/shopping');
  const swapped = backend.state.mealSwaps[0] as { to_slug: string };
  expect(swapped.to_slug).not.toBe('oats-and-berries');
  await expect(page.getByText(/Rolled oats/).filter({ visible: true })).toHaveCount(0);
});

test('Undo brings the previous meal back', async ({ page }) => {
  const backend = await today(page);
  await expect(optionCards(page).first()).toBeVisible();
  await optionCards(page).first().click();
  await expect.poll(() => backend.state.mealSwaps.length).toBe(1);
  await button(page, t.undoSwap).filter({ visible: true }).first().click();
  await expect.poll(() => backend.state.mealSwaps.length).toBe(0);
  await expect(shown(page, t.undoneSwap)).toBeVisible();
  await expect(page.getByText(/Oats and berries · \d+ kcal/).filter({ visible: true }).first()).toBeVisible();
});

test('swapping a meal that was marked as eaten clears "eaten" for it and says so', async ({ page }) => {
  await today(page);
  await page.getByRole('button', { name: new RegExp(`Breakfast.*${t.markEaten}`) }).filter({ visible: true }).first().click();
  await expect(page.getByText(t.unmarkEaten).filter({ visible: true }).first()).toBeVisible();
  const breakfastOption = page.getByRole('button', { name: /^Use (Greek yogurt bowl|Eggs on toast|Protein pancakes)/ }).filter({ visible: true }).first();
  const name = (await breakfastOption.getAttribute('aria-label'))!.replace(/^Use /, '').split('. ')[0];
  await breakfastOption.click();
  await expect(shown(page, t.swappedNotEaten(name))).toBeVisible();
});

test('"See more" lists up to 8 options that all fit the meal, with a search box', async ({ page }) => {
  await today(page);
  await button(page, t.seeMore).filter({ visible: true }).first().click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  const items = sheet.getByRole('button').filter({ hasText: /^Use / });
  const n = await items.count();
  expect(n).toBeGreaterThanOrEqual(3);
  expect(n).toBeLessThanOrEqual(8);
  // Every one is a breakfast recipe (this is the first meal), nothing else.
  for (const label of await items.allTextContents()) expect(label).toMatch(/Greek yogurt bowl|Eggs on toast|Protein pancakes/);
  await sheet.getByLabel(t.searchRecipes).fill('pancakes');
  await expect(items).toHaveCount(1);
  await sheet.getByLabel(t.searchRecipes).fill('zzzz');
  await expect(sheet.getByText(t.noOptionsFound)).toBeVisible();
});


test('Nutrition offers the same slot-fitting choices through "Swap meal" and records the swap', async ({ page }) => {
  const backend = await signedInWithPlan(page);
  await page.goto('/nutrition');
  await button(page, en.nutrition.swapMeal).filter({ visible: true }).first().click();
  const sheet = page.getByRole('dialog');
  const picks = sheet.getByRole('button').filter({ hasText: /^Use / });
  await expect(picks.first()).toBeVisible();
  for (const label of await picks.allTextContents()) expect(label).toMatch(/Greek yogurt bowl|Eggs on toast|Protein pancakes/);
  await picks.first().click();
  await expect.poll(() => backend.state.mealSwaps.length).toBe(1);
});
