import { expect, test, type Page } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { EDITABLE_SESSION_ID, editableWorkout } from '../support/fixtures';
import { FIXED_NOW, button, shown, signedInWithPlan } from '../support/app';

const d = en.workout.history.detail;
const p = en.home.progress;

/** A signed-in user with one past workout that has a typo in it (1000 kg instead of 100 kg), opened in Progress. */
async function withTypo(page: Page) {
  const backend = await signedInWithPlan(page);
  backend.state.editable = editableWorkout(new Date(FIXED_NOW));
  await page.getByRole('tab', { name: en.home.tabs.progress, exact: true }).click();
  return backend;
}
const openWorkout = async (page: Page) => {
  await page.getByRole('button', { name: new RegExp(`Upper body.*${en.workout.history.sessionLine(4, 1000 * 5 + 100 * 5 + 100 * 5 + 50 * 8).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).first().click();
  await expect(page).toHaveURL(new RegExp(`/history/${EDITABLE_SESSION_ID}`));
};
const setRow = (page: Page, n: number) => page.getByRole('button', { name: new RegExp(`^${d.set(n)}`) }).first();

test('a typo makes a fake record; fixing the set in History brings the real one back', async ({ page }) => {
  const backend = await withTypo(page);
  // Progress shows the typo as the record.
  await expect(page.getByText(p.prLine(1000, 5, 'x').split(' · ')[0], { exact: false }).first()).toBeVisible();
  await expect(page.getByText(p.prValue(1166.7), { exact: true })).toBeVisible();

  await openWorkout(page);
  // The workout: date, duration, every set (weight × reps, RPE), total volume, and your rating.
  await expect(shown(page, 'Upper body')).toBeVisible();
  await expect(shown(page, d.stats(45, 4, 6400), false)).toBeVisible();
  await expect(shown(page, d.rating(en.workout.summary.ratings[3]))).toBeVisible();
  await expect(shown(page, d.setLine(100, 5, 8))).toBeVisible();
  await expect(shown(page, d.setLine(1000, 5, null))).toBeVisible();
  await expect(shown(page, d.setLine(50, 8, null))).toBeVisible();

  // Fix the typo.
  await setRow(page, 3).click();
  await page.getByLabel(d.weight, { exact: true }).fill('100');
  await button(page, d.save).click();
  await expect(shown(page, d.setLine(100, 5, null))).toBeVisible();
  await expect(shown(page, d.setLine(1000, 5, null))).toHaveCount(0);
  await expect.poll(() => backend.writesTo('/set_logs').length).toBeGreaterThan(0);
  const sent = backend.writesTo('/set_logs').map((w) => w.body as { id?: string; weight_kg?: number }).find((b) => b?.id?.endsWith('3'));
  expect(sent).toMatchObject({ weight_kg: 100, reps: 5 });

  // Progress recalculates: the record is the real one.
  await button(page, en.common.back).click();
  await expect(page.getByText(p.prValue(116.7), { exact: true })).toBeVisible();
  await expect(page.getByText(p.prValue(1166.7), { exact: true })).toHaveCount(0);
});

test('a typo like 1000 kg is refused in the edit, with the range in the message', async ({ page }) => {
  const backend = await withTypo(page);
  await openWorkout(page);
  await setRow(page, 1).click();
  await page.getByLabel(d.weight, { exact: true }).fill('1000');
  await button(page, d.save).click();
  await expect(page.getByRole('alert').filter({ hasText: d.errors.weight(0, 500) })).toBeVisible();
  await page.getByLabel(d.reps, { exact: true }).fill('0');
  await button(page, d.save).click();
  await expect(page.getByRole('alert').filter({ hasText: d.errors.reps(1, 100) })).toBeVisible();
  expect(backend.writesTo('/set_logs')).toHaveLength(0); // nothing was sent
});

test('deleting a set asks first; keeping it changes nothing, deleting removes it and fixes the record', async ({ page }) => {
  const backend = await withTypo(page);
  await openWorkout(page);

  await setRow(page, 3).click();
  await button(page, d.deleteSet).click();
  await expect(shown(page, d.confirmSetTitle)).toBeVisible();
  await button(page, d.keep).click();
  // Back in the edit, nothing deleted and nothing sent.
  await expect(page.getByRole('dialog', { name: d.confirmSetTitle })).toHaveCount(0);
  await expect(button(page, d.save)).toBeVisible();
  expect(backend.writesTo('/set_logs')).toHaveLength(0);

  await button(page, d.deleteSet).click();
  await page.getByRole('dialog', { name: d.confirmSetTitle }).getByRole('button', { name: d.deleteSet, exact: true }).click();
  await expect(shown(page, d.setLine(1000, 5, null))).toHaveCount(0);
  await expect.poll(() => backend.writesTo('/set_logs').some((w) => w.method === 'DELETE')).toBe(true);

  await button(page, en.common.back).click();
  await expect(page.getByText(p.prValue(116.7), { exact: true })).toBeVisible();
});

test('deleting the whole workout asks first and removes it from History', async ({ page }) => {
  const backend = await withTypo(page);
  await openWorkout(page);
  await button(page, d.deleteWorkout).click();
  await expect(shown(page, d.confirmWorkoutTitle)).toBeVisible();
  await button(page, d.deleteWorkout).last().click();
  await expect.poll(() => backend.writesTo('/workout_sessions').some((w) => w.method === 'DELETE')).toBe(true);
  await expect(page).not.toHaveURL(/\/history\//);
  await expect(page.getByText(en.workout.history.title, { exact: true })).toHaveCount(0); // no workouts left, no History section
});

test('offline: a correction shows at once, waits in the queue, and is sent when the connection is back', async ({ page }) => {
  const backend = await withTypo(page);
  await openWorkout(page);
  backend.state.offline = true;

  await setRow(page, 3).click();
  await page.getByLabel(d.weight, { exact: true }).fill('100');
  await button(page, d.save).click();
  // Shown straight away, with a note that it is waiting.
  await expect(shown(page, d.setLine(100, 5, null))).toBeVisible();
  await expect(shown(page, d.queued)).toBeVisible();
  expect(backend.writesTo('/set_logs')).toHaveLength(0);

  // Back online: the queue is sent and the note goes.
  backend.state.offline = false;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => backend.writesTo('/set_logs').length).toBeGreaterThan(0);
  await expect(page.getByText(d.queued)).toHaveCount(0);
});
