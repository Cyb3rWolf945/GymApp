import { expect, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { button, shown, signedInWithPlan } from '../support/app';

test('Today leads with a hero card for the workout, and Start still starts it', async ({ page }) => {
  await signedInWithPlan(page);
  const hero = page.getByTestId('workout-hero').filter({ visible: true });
  await expect(hero).toHaveCount(1);
  await expect(hero.getByRole('button', { name: en.home.startWorkout, exact: true })).toBeVisible();
  // Its exercise rows are still there and big enough to tap.
  const row = hero.getByRole('button', { name: /Barbell bench press/ }).first();
  await expect(row).toBeVisible();
  expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(56);
  await hero.getByRole('button', { name: en.home.startWorkout, exact: true }).click();
  await expect(page).toHaveURL(/\/workout/);
});

test('after a set, the rest timer is a ring with the time left; skipping removes it', async ({ page }) => {
  await signedInWithPlan(page);
  await button(page, en.home.startWorkout).click();
  await expect(shown(page, 'Barbell bench press', false)).toBeVisible();
  await expect(page.getByTestId('rest-ring')).toHaveCount(0); // nothing to rest from yet
  await button(page, en.workout.logSet).click();
  const ring = page.getByTestId('rest-ring');
  await expect(ring).toBeVisible();
  await expect(ring).toContainText(/^\d+:\d{2}$/);
  expect((await ring.boundingBox())!.width).toBeGreaterThanOrEqual(150);
  await button(page, en.workout.skipRest).click();
  await expect(ring).toHaveCount(0);
});
