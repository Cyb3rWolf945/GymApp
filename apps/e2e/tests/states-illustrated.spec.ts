import { expect, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { button, shown, signedInWithPlan } from '../support/app';

// Empty, missing, locked and failed states all share one frame: a picture for the topic, the message, the next action.
const art = (page: import('@playwright/test').Page, kind: string) => page.getByTestId(`illustration-${kind}`).filter({ visible: true }).first();

test('a failed request shows the error picture with the message and Try again', async ({ page }) => {
  const backend = await signedInWithPlan(page);
  backend.state.failing = ['generation_jobs'];
  await page.goto('/plan');
  await expect(shown(page, en.home.loadError)).toBeVisible();
  await expect(art(page, 'error')).toBeVisible();
  // Decoration only: hidden from screen readers, and it does not take taps.
  await expect(art(page, 'error')).toHaveAttribute('aria-hidden', 'true');
  expect((await art(page, 'error').boundingBox())!.height).toBeGreaterThanOrEqual(100);
  backend.state.failing = [];
  await button(page, en.common.retry).click();
  await expect(shown(page, 'Upper body')).toBeVisible();
  await expect(page.getByTestId('illustration-error').filter({ visible: true })).toHaveCount(0);
});

test('nothing logged yet: Progress shows a workout picture and the next step', async ({ page }) => {
  await signedInWithPlan(page);
  await page.goto('/progress');
  await expect(shown(page, en.home.progressEmptyTitle)).toBeVisible();
  await expect(art(page, 'workout')).toBeVisible();
  await expect(button(page, en.home.startWorkout)).toBeVisible();
  // The picture and the next step come first, so they are on the first screen without scrolling.
  await expect(art(page, 'workout')).toBeInViewport();
  await expect(button(page, en.home.startWorkout)).toBeInViewport();
});

test('a recipe that does not exist shows the "missing" picture', async ({ page }) => {
  await signedInWithPlan(page);
  await page.goto('/recipe/no-such-recipe');
  await expect(shown(page, en.nutrition.recipe.missing)).toBeVisible();
  await expect(art(page, 'missing')).toBeVisible();
});

test('Nutrition without Pro shows the locked picture and the way in', async ({ page }) => {
  const backend = await signedInWithPlan(page);
  backend.state.entitled = false;
  await page.goto('/nutrition');
  await expect(shown(page, en.nutrition.lockedTitle)).toBeVisible();
  await expect(art(page, 'locked')).toBeVisible();
  await expect(button(page, en.nutrition.lockedCta)).toBeVisible();
});

test('the shopping list error uses the error picture', async ({ page }) => {
  const backend = await signedInWithPlan(page);
  backend.state.failing = ['recipes'];
  await page.goto('/shopping');
  await expect(shown(page, en.nutrition.shopping.loadError)).toBeVisible();
  await expect(art(page, 'error')).toBeVisible();
});
