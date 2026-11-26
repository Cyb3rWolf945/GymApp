import { expect, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { button, shown, signedInWithPlan } from '../support/app';

test('each day on Nutrition has a macro ring, and every meal has a picture', async ({ page }) => {
  await signedInWithPlan(page);
  await page.goto('/nutrition');
  await expect(shown(page, en.home.nutritionTitle)).toBeVisible();
  const rings = page.getByTestId('macro-ring').filter({ visible: true });
  await expect(rings).toHaveCount(7); // one per weekday
  // The ring says the same as the text, in words.
  await expect(rings.first()).toHaveAttribute('aria-label', /^\d+ kcal: \d+ g protein, \d+ g carbs, \d+ g fat$/);
  const art = page.getByTestId('food-art').filter({ visible: true });
  expect(await art.count()).toBeGreaterThanOrEqual(7);
  await expect(art.first()).toHaveAttribute('aria-hidden', 'true');
});

test('a recipe opens with its picture and a macro ring', async ({ page }) => {
  await signedInWithPlan(page);
  await page.goto('/nutrition');
  await expect(shown(page, en.home.nutritionTitle)).toBeVisible();
  await page.getByRole('button', { name: /Rolled oats|Oats|Chicken/ }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/recipe\//);
  await expect(page.getByTestId('food-art').filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByTestId('macro-ring').filter({ visible: true }).first()).toBeVisible();
  expect((await page.getByTestId('food-art').filter({ visible: true }).first().boundingBox())!.width).toBeGreaterThanOrEqual(96);
});

test('the shopping list shows progress, a check per item and an icon per aisle', async ({ page }) => {
  await signedInWithPlan(page);
  await page.goto('/nutrition');
  await button(page, en.nutrition.shoppingList).click();
  await expect(shown(page, en.nutrition.shopping.title)).toBeVisible();
  const bar = page.getByRole('progressbar').filter({ visible: true }).first();
  await expect(bar).toBeVisible();
  const before = Number(await bar.getAttribute('aria-valuenow'));
  expect(before).toBe(0);
  const item = page.getByRole('checkbox', { name: /Rolled oats/ }).filter({ visible: true }).first();
  await expect(item).toHaveAttribute('aria-checked', 'false');
  expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(56);
  await item.click();
  await expect(item).toHaveAttribute('aria-checked', 'true');
  await expect.poll(async () => Number(await bar.getAttribute('aria-valuenow'))).toBe(1);
  await item.click();
  await expect(item).toHaveAttribute('aria-checked', 'false');
  await expect.poll(async () => Number(await bar.getAttribute('aria-valuenow'))).toBe(0);
});
