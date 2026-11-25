import { expect, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { FIXED_NOW, button, shown, signedInWithPlan } from '../support/app';

const x = en.exercise;

const openFromPlan = async (page: import('@playwright/test').Page, name: RegExp) => {
  await page.getByRole('tab', { name: en.home.tabs.plan, exact: true }).click();
  await page.getByRole('button', { name }).first().click();
};

test('exercise screen: steps, muscles, and your own history', async ({ page }) => {
  const backend = await signedInWithPlan(page);
  backend.state.history = FIXED_NOW;

  await openFromPlan(page, /Barbell bench press/);
  await expect(page).toHaveURL(/\/exercise\/barbell-bench-press/);

  await expect(shown(page, 'Barbell bench press')).toBeVisible();
  await expect(shown(page, x.equipment('barbell'))).toBeVisible();
  // Steps come numbered from the catalog text (the app numbers them itself).
  await expect(shown(page, '1. Lie on the bench with your eyes under the bar.')).toBeVisible();
  await expect(shown(page, '3. Press it back up.')).toBeVisible();
  // Muscles on the map, with their names.
  await expect(shown(page, x.muscles)).toBeVisible();
  await expect(shown(page, `${x.primary}: Pectoralis major`)).toBeVisible();
  await expect(page.getByLabel(x.musclesLabel('Pectoralis major', 'Triceps brachii, Deltoid anterior')).first()).toBeVisible();
  // History: three workouts of bench, a best one-rep max and the trend.
  await expect(shown(page, x.history)).toBeVisible();
  await expect(page.getByText(/^Best estimated one-rep max: [\d.]+ kg$/).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole('img', { name: /Line chart of your estimated one-rep max for Barbell bench press over 3 workouts/ })).toBeVisible();
  await expect(shown(page, x.sessionLine(75, 10))).toBeVisible();

  expect(backend.functionCalls).toEqual([]);
});

test('exercise screen: nothing breaks without steps, media or history', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await signedInWithPlan(page);

  // This catalog row has no instructions and a media link that fails to load; no sets logged yet.
  await openFromPlan(page, /Standing barbell overhead press/);
  await expect(page).toHaveURL(/\/exercise\/standing-barbell-overhead-press/);
  await expect(shown(page, x.noSteps)).toBeVisible();
  await expect(shown(page, x.historyEmpty)).toBeVisible();
  await expect(page.getByRole('img', { name: x.media('Standing barbell overhead press') })).toHaveCount(0);
  expect(errors).toEqual([]);

  // A slug that is not in the catalog.
  await page.goto('/exercise/does-not-exist');
  await expect(shown(page, x.missing)).toBeVisible();
});

test('"Swap exercise" on the exercise screen records the swap without any AI call, then goes back to the plan', async ({ page }) => {
  const backend = await signedInWithPlan(page);
  backend.state.rpc = { swap_candidates: [{ slug: 'dumbbell-bench-press', name: 'Dumbbell bench press', equipment: 'dumbbells', level: 'beginner' }] };

  await openFromPlan(page, /Barbell bench press/);
  await button(page, en.home.swap.action).click();
  await button(page, en.home.swap.pick('Dumbbell bench press')).click();

  await expect.poll(() => backend.writesTo('/plan_swaps').length).toBeGreaterThan(0);
  const body = backend.writesTo('/plan_swaps').at(-1)!.body as { from_slug: string; to_slug: string; day_index: number };
  expect(body).toMatchObject({ from_slug: 'barbell-bench-press', to_slug: 'dumbbell-bench-press', day_index: 0 });
  expect(backend.functionCalls).toEqual([]);
  await expect(page).toHaveURL(/\/plan/);
});

test('it opens from Today, from Personal records, and from the workout without losing the set in progress', async ({ page }) => {
  const backend = await signedInWithPlan(page);
  backend.state.history = FIXED_NOW;

  // Today.
  await page.goto('/');
  await page.getByRole('button', { name: /Barbell bench press/ }).first().click();
  await expect(page).toHaveURL(/\/exercise\/barbell-bench-press/);

  // Personal records on Progress.
  await page.goto('/progress');
  await expect(shown(page, en.home.progress.prsTitle)).toBeVisible();
  await page.getByRole('button', { name: /Barbell back squat/ }).first().click();
  await expect(page).toHaveURL(/\/exercise\/barbell-back-squat/);

  // The workout logger: the info button sits next to the exercise and the set in progress stays.
  await page.goto('/');
  await button(page, en.home.startWorkout).click();
  await expect(page).toHaveURL(/\/workout/);
  await button(page, en.workout.logSet).click();
  const skip = button(page, en.workout.skipRest);
  if (await skip.isVisible().catch(() => false)) await skip.click();
  const line = page.getByText(/^Set 2 of 3/).filter({ visible: true }).first();
  await expect(line).toBeVisible();
  await button(page, en.workout.info).click();
  await expect(page).toHaveURL(/\/exercise\/barbell-bench-press/);
  await button(page, en.common.back).click();
  await expect(page).toHaveURL(/\/workout/);
  await expect(line).toBeVisible();
  expect(backend.writesTo('/workout_sessions').every((w) => !(w.body as { finished_at?: string | null }).finished_at)).toBe(true);
});
