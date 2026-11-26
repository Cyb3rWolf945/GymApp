import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { type Page, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { button, shown, signedInWithPlan } from '../support/app';

// Key shots for the Nutrition PR: the day cards with macro rings and meal art, a recipe, and the shopping list.
const DIR = process.env.SHOTS_DIR ?? '/tmp/shots';

async function shot(page: Page, name: string) {
  const project = test.info().project.name;
  mkdirSync(join(DIR, project), { recursive: true });
  await page.screenshot({ path: join(DIR, project, `${name}.jpg`), type: 'jpeg', quality: 80 });
}

test('nutrition', async ({ page }) => {
  await signedInWithPlan(page);
  await page.goto('/nutrition');
  await shown(page, en.home.nutritionTitle).waitFor();
  await page.getByTestId('macro-ring').filter({ visible: true }).first().waitFor();
  await page.waitForTimeout(600);
  await shot(page, 'nutrition-days');

  await page.getByRole('button', { name: /Rolled oats|Oats|Chicken/ }).filter({ visible: true }).first().click();
  await page.getByTestId('macro-ring').filter({ visible: true }).first().waitFor();
  await page.waitForTimeout(600);
  await shot(page, 'recipe');

  await page.goto('/nutrition');
  await button(page, en.nutrition.shoppingList).click();
  await shown(page, en.nutrition.shopping.title).waitFor();
  await page.getByRole('checkbox', { name: /Rolled oats/ }).filter({ visible: true }).first().click();
  await page.waitForTimeout(600);
  await shot(page, 'shopping-list');
});
