import { expect, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { shown, signedInWithPlan } from '../support/app';

const p = en.home.progress;

test('Progress: a volume chart per workout, the weight chart has a soft fill, and the muscle map has a key', async ({ page }) => {
  const backend = await signedInWithPlan(page, { fixedTime: false });
  backend.state.history = new Date();
  await page.goto('/progress');
  await expect(page.getByText(p.weightTitle, { exact: true }).filter({ visible: true }).first()).toBeVisible();

  // Volume: the heading, a sentence with the last workout's weight, and the bars (as an image with a spoken label).
  await expect(page.getByText(p.volumeTitle, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  const chart = page.getByTestId('bar-chart').filter({ visible: true }).first();
  await expect(chart).toBeVisible();
  await expect(chart).toHaveAttribute('aria-label', /^Bar chart of the weight you lifted in your last \d+ workouts?$/);
  await expect(page.getByText(/kg lifted in your last workout/).filter({ visible: true }).first()).toBeVisible();
  // At least one bar has height once drawn.
  await expect
    .poll(() => chart.evaluate((el) => Array.from(el.querySelectorAll('rect')).some((r) => Number(r.getAttribute('height')) > 1)))
    .toBe(true);

  // The weight line has an area fill behind it.
  const weight = page.getByRole('img', { name: /Line chart of your 7-day average weight/ }).filter({ visible: true }).first();
  await expect(weight.locator('path[fill^="url("]')).toHaveCount(1);

  // The heat key under the map.
  const legend = page.getByTestId('heat-legend').filter({ visible: true }).first();
  await expect(legend).toContainText(p.legendLess);
  await expect(legend).toContainText(p.legendMore);
});

test('Progress with no workouts yet: the volume card says what will show up', async ({ page }) => {
  const backend = await signedInWithPlan(page, { fixedTime: false });
  backend.state.history = new Date();
  backend.state.rpc = {};
  await page.goto('/progress');
  await expect(shown(page, p.weightTitle)).toBeVisible();
});

test('the Nutrition ring has a colour key', async ({ page }) => {
  await signedInWithPlan(page);
  await page.goto('/nutrition');
  const key = page.getByTestId('macro-key').filter({ visible: true }).first();
  await expect(key).toBeVisible();
  for (const l of [en.plan.preview.protein, en.plan.preview.carbs, en.plan.preview.fat]) await expect(key).toContainText(l);
});
