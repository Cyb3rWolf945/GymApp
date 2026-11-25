import { expect, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { FIXED_NOW, button, shown, signedInWithPlan } from '../support/app';

// E-58: skeletons while loading, an error with "Try again" when a request fails, empty states with a next action,
// and a banner while the device is offline.

const retry = en.common.retry;

test('a data screen shows a skeleton while it loads, then the content', async ({ page }) => {
  const backend = await signedInWithPlan(page);
  backend.state.delay.generation_jobs = 1500;
  await page.goto('/plan');
  const skeleton = page.getByRole('progressbar', { name: en.common.loading });
  await expect(skeleton.first()).toBeVisible();
  await expect(shown(page, en.home.planTitle)).toBeVisible();
  await expect(skeleton).toHaveCount(0);
});

test('Today and Plan: a failed request shows an error, and Try again recovers', async ({ page }) => {
  const backend = await signedInWithPlan(page);
  backend.state.failing = ['generation_jobs'];
  await page.goto('/plan');
  await expect(shown(page, en.home.loadError)).toBeVisible();
  backend.state.failing = [];
  await button(page, retry).click();
  await expect(shown(page, 'Upper body')).toBeVisible();
});

test('Progress: a failed request shows an error, not an empty screen, and Try again recovers', async ({ page }) => {
  const backend = await signedInWithPlan(page);
  backend.state.history = FIXED_NOW;
  backend.state.failing = ['set_logs'];
  await page.goto('/progress');
  await expect(shown(page, en.home.progress.loadError)).toBeVisible();
  await expect(page.getByText(en.home.progressEmptyTitle)).toHaveCount(0);
  backend.state.failing = [];
  await button(page, retry).click();
  await expect(shown(page, en.home.progress.prsTitle)).toBeVisible();
});

test('Recipe and Shopping list: a failed request shows an error and Try again recovers', async ({ page }) => {
  const backend = await signedInWithPlan(page);
  backend.state.failing = ['recipes'];

  await page.goto('/recipe/oats-and-berries');
  await expect(shown(page, en.nutrition.recipe.loadError)).toBeVisible();
  backend.state.failing = [];
  await button(page, retry).click();
  await expect(shown(page, 'Oats and berries', false)).toBeVisible();

  backend.state.failing = ['recipes'];
  await page.goto('/shopping');
  await expect(shown(page, en.nutrition.shopping.loadError)).toBeVisible();
  backend.state.failing = [];
  await button(page, retry).click();
  await expect(shown(page, 'Rolled oats')).toBeVisible();
});

test('Progress with nothing logged yet is an invitation with a next action', async ({ page }) => {
  await signedInWithPlan(page);
  await page.goto('/progress');
  await expect(shown(page, en.home.progressEmptyTitle)).toBeVisible();
  await button(page, en.home.startWorkout).click();
  await expect(page).toHaveURL(/localhost:\d+\/$/);
  await expect(shown(page, en.home.title)).toBeVisible();
});

test('an offline banner shows while the device has no connection, and goes when it is back', async ({ page, context }) => {
  await signedInWithPlan(page);
  await expect(shown(page, en.home.title)).toBeVisible();
  await expect(page.getByText(en.common.offline)).toHaveCount(0);

  await context.setOffline(true);
  await expect(shown(page, en.common.offline)).toBeVisible();
  // It is on every screen: still there after moving around the app.
  await page.getByRole('tab', { name: en.home.tabs.plan, exact: true }).click();
  await expect(shown(page, en.common.offline)).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText(en.common.offline)).toHaveCount(0);
});
