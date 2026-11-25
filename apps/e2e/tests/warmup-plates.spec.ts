import { expect, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { button, shown, signedInWithPlan } from '../support/app';

const w = en.workout;

/** Today → Start workout, then the weight stepper up to `kg` (bench press is the first barbell compound of the plan). */
async function startAt(page: import('@playwright/test').Page, kg: number) {
  await button(page, en.home.startWorkout).click();
  await expect(page).toHaveURL(/\/workout/);
  await expect(shown(page, 'Barbell bench press', false)).toBeVisible();
  for (let i = 0; i < kg / 2.5; i++) await button(page, 'Increase Weight').click();
}

const setRows = (backend: Awaited<ReturnType<typeof signedInWithPlan>>) =>
  backend.writesTo('/set_logs').flatMap((x) => (Array.isArray(x.body) ? x.body : [x.body])) as { weight_kg: number; reps: number; is_warmup: boolean }[];

test('warm-up sets for the first barbell lift: logged as warm-ups, the working sets stay Set 1 of 3', async ({ page }) => {
  const backend = await signedInWithPlan(page);
  await startAt(page, 100);

  await expect(shown(page, w.warmup.title)).toBeVisible();
  for (const [weight, reps, bar] of [[20, 10, true], [40, 5, false], [60, 3, false], [80, 2, false]] as const) {
    await expect(shown(page, w.warmup.set(weight, 'kg', reps, bar))).toBeVisible();
  }
  await button(page, w.warmup.log).click();
  await expect(shown(page, w.warmup.title)).toHaveCount(0);

  // Four warm-up rows were sent, flagged, with the planned weights.
  await expect.poll(() => setRows(backend).length).toBe(4);
  expect(setRows(backend).every((s) => s.is_warmup)).toBe(true);
  expect(setRows(backend).map((s) => s.weight_kg)).toEqual([20, 40, 60, 80]);

  // The workout still starts at the first working set, with the same weight, and warm-ups say so in the list.
  await expect(shown(page, 'Set 1 of 3', false)).toBeVisible();
  await expect(shown(page, `${w.warmup.label} · 40 kg × 5`, false)).toBeVisible();

  // A working set is a normal row.
  await button(page, w.logSet).click();
  await expect.poll(() => setRows(backend).length).toBe(5);
  expect(setRows(backend).at(-1)).toMatchObject({ weight_kg: 100, is_warmup: false });
});

test('skipping the warm-up sends nothing; with no weight yet there is nothing to suggest', async ({ page }) => {
  const backend = await signedInWithPlan(page);
  await button(page, en.home.startWorkout).click();
  await expect(shown(page, 'Barbell bench press', false)).toBeVisible();
  await expect(shown(page, w.warmup.title)).toHaveCount(0); // 0 kg: no suggestion

  for (let i = 0; i < 16; i++) await button(page, 'Increase Weight').click(); // 40 kg
  await expect(shown(page, w.warmup.title)).toBeVisible();
  await button(page, w.warmup.skip).click();
  await expect(shown(page, w.warmup.title)).toHaveCount(0);
  expect(setRows(backend)).toHaveLength(0);
});

test('plate calculator: plates per side for the weight in the stepper', async ({ page }) => {
  await signedInWithPlan(page);
  await startAt(page, 100);
  await button(page, w.plates.open(100, 'kg')).click();
  await expect(shown(page, w.plates.total(100, 'kg'))).toBeVisible();
  await expect(shown(page, w.plates.side(1, 25, 'kg'))).toBeVisible();
  await expect(shown(page, w.plates.side(1, 15, 'kg'))).toBeVisible();
  await expect(shown(page, w.plates.barLine(20, 'kg'))).toBeVisible();
});

test('plate calculator: small plates make the in-between weights', async ({ page }) => {
  await signedInWithPlan(page);
  await startAt(page, 100);
  await button(page, 'Decrease Weight').click(); // 97.5 kg
  await button(page, w.plates.open(97.5, 'kg')).click();
  // 97.5 kg = 20 kg bar + 38.75 kg per side = 25 + 10 + 2.5 + 1.25. (Weights the plates cannot make are covered by the unit tests.)
  await expect(shown(page, w.plates.side(1, 25, 'kg'))).toBeVisible();
  await expect(shown(page, w.plates.side(1, 10, 'kg'))).toBeVisible();
  await expect(shown(page, w.plates.side(1, 2.5, 'kg'))).toBeVisible();
  await expect(shown(page, w.plates.side(1, 1.25, 'kg'))).toBeVisible();
});

test('Settings: a different bar changes the plates', async ({ page }) => {
  await signedInWithPlan(page);
  await page.goto('/settings');
  await expect(shown(page, en.plateSettings.title)).toBeVisible();
  await page.getByLabel(en.plateSettings.bar('kg')).fill('25');
  await button(page, en.common.save).first().click();
  await expect(shown(page, en.plateSettings.saved)).toBeVisible();

  await page.goto('/');
  await startAt(page, 100);
  await button(page, w.plates.open(100, 'kg')).click();
  await expect(shown(page, w.plates.barLine(25, 'kg'))).toBeVisible();
  await expect(shown(page, w.plates.side(1, 25, 'kg'))).toBeVisible();
  await expect(shown(page, w.plates.side(1, 10, 'kg'))).toBeVisible();
  await expect(shown(page, w.plates.side(1, 2.5, 'kg'))).toBeVisible();
});
