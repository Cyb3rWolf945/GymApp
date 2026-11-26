import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { button, shown, signedInWithPlan } from '../support/app';

const t = en.workout.summary;

/** Today → start → log two sets → finish → the summary. */
async function finishedWorkout(page: Page) {
  await signedInWithPlan(page);
  await button(page, en.home.startWorkout).click();
  await expect(page).toHaveURL(/\/workout/);
  for (let i = 0; i < 2; i++) {
    if (i === 0) for (let k = 0; k < 4; k++) await button(page, 'Increase Weight').click(); // 10 kg; the next set starts from it
    await button(page, en.workout.logSet).click();
    const skip = button(page, en.workout.skipRest);
    if (await skip.isVisible().catch(() => false)) await skip.click();
  }
  return page;
}

test('logged sets are big rows: a round badge with the set number, the weight and reps in large type', async ({ page }) => {
  await finishedWorkout(page);
  await expect(shown(page, en.workout.loggedTitle)).toBeVisible();
  const row = page.getByLabel(/^Barbell bench press: 10 kg × \d+/).first();
  await expect(row).toBeVisible();
  expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(64);
  await expect(page.getByLabel(/^Barbell bench press: 10 kg × \d+/)).toHaveCount(2);
});

test('the summary can be shared as an image: Share workout makes a 1080 x 1350 PNG', async ({ page }) => {
  await finishedWorkout(page);
  await button(page, en.workout.finish).first().click();
  await expect(page).toHaveURL(/\/workout-summary/);
  const download = page.waitForEvent('download');
  await button(page, t.share).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('fuelift-workout.png');
  const bytes = readFileSync((await file.path())!);
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  expect(bytes.readUInt32BE(16)).toBe(1080); // IHDR width
  expect(bytes.readUInt32BE(20)).toBe(1350); // IHDR height
  expect(bytes.length).toBeGreaterThan(5_000); // something was drawn
  await expect(shown(page, t.shareDownloaded)).toBeVisible();
});
