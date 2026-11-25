import { expect, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { SESSION_STORAGE_KEY, fakeSession } from '../support/fixtures';
import { button, shown, start } from '../support/app';

// A signed-in Pro user with a plan already generated.
async function signedInWithPlan(page: import('@playwright/test').Page) {
  const backend = await start(page);
  backend.completeCheckout();
  backend.state.jobs = [
    { id: '20000000-0000-4000-8000-000000000001', kind: 'workout_plan', status: 'done', created_at: new Date().toISOString(), result: { plan: (await import('../support/fixtures')).WORKOUT_PLAN } },
    { id: '20000000-0000-4000-8000-000000000002', kind: 'nutrition_plan', status: 'done', created_at: new Date().toISOString(), result: { plan: (await import('../support/fixtures')).NUTRITION_PLAN } },
  ];
  backend.state.profile = { user_id: 'u', onboarding: { preferredDays: ['mon', 'thu'], equipment: ['full_gym'], contraindications: [] }, experience: 'beginner' };
  await page.addInitScript(([key, session]) => localStorage.setItem(key, JSON.stringify(session)), [SESSION_STORAGE_KEY, fakeSession()] as const);
  await page.goto('/');
  return backend;
}

test('workout logging: start, log sets, finish, see the summary', async ({ page }) => {
  const backend = await signedInWithPlan(page);

  await button(page, en.home.startWorkout).click();
  await expect(page).toHaveURL(/\/workout/);
  await expect(shown(page, 'Barbell bench press', false)).toBeVisible();

  for (let i = 0; i < 2; i++) {
    await button(page, en.workout.logSet).click();
    // After a set the rest timer shows; skip it to log the next one.
    const skip = button(page, en.workout.skipRest);
    if (await skip.isVisible().catch(() => false)) await skip.click();
  }
  await button(page, en.workout.finish).first().click();

  await expect(page).toHaveURL(/\/workout-summary/);
  await expect(shown(page, en.workout.summary.title)).toBeVisible();

  // What the app sent: the workout and its two sets (to the fake backend), with weights and reps.
  await expect.poll(() => backend.writesTo('/set_logs').length).toBeGreaterThan(0);
  const sets = backend.writesTo('/set_logs').flatMap((w) => (Array.isArray(w.body) ? w.body : [w.body])) as { reps: number; weight_kg: number }[];
  expect(sets.length).toBeGreaterThanOrEqual(2);
  expect(sets.every((s) => s.reps > 0)).toBe(true);
  const finished = backend.writesTo('/workout_sessions').flatMap((w) => (Array.isArray(w.body) ? w.body : [w.body])) as { finished_at: string | null }[];
  expect(finished.some((s) => s.finished_at)).toBe(true);
});

test('shopping list renders from the meal plan and keeps checked items', async ({ page }) => {
  const backend = await signedInWithPlan(page);

  await page.goto('/nutrition');
  await expect(shown(page, en.home.nutritionTitle)).toBeVisible();
  await button(page, en.nutrition.shoppingList).click();

  await expect(page).toHaveURL(/\/shopping/);
  await expect(shown(page, en.nutrition.shopping.title)).toBeVisible();
  // Quantities are summed over the week (3 training days Mon/Thu... and rest days) and grouped by category.
  await expect(shown(page, 'Rolled oats')).toBeVisible();
  await expect(shown(page, 'Chicken breast')).toBeVisible();
  await expect(shown(page, en.nutrition.shopping.categories.grains)).toBeVisible();
  await expect(shown(page, en.nutrition.shopping.categories.meat)).toBeVisible();

  await shown(page, 'Rolled oats').click();
  await expect.poll(() => backend.writesTo('/shopping_list_items').length).toBeGreaterThan(0);
  const row = backend.writesTo('/shopping_list_items')[0].body as { label: string; checked: boolean };
  expect(row).toMatchObject({ label: 'Rolled oats', checked: true });
  await expect(button(page, en.nutrition.shopping.clear)).toBeVisible();
});
