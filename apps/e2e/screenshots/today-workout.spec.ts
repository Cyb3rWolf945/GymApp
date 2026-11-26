import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { type Page, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { button, signedInWithPlan } from '../support/app';

// Key shots for the Today and workout PR: the hero card and the rest-timer ring.
const DIR = process.env.SHOTS_DIR ?? '/tmp/shots';

async function shot(page: Page, name: string) {
  const project = test.info().project.name;
  mkdirSync(join(DIR, project), { recursive: true });
  await page.screenshot({ path: join(DIR, project, `${name}.jpg`), type: 'jpeg', quality: 80 });
}

test('today hero and rest ring', async ({ page }) => {
  await signedInWithPlan(page);
  await page.getByTestId('workout-hero').filter({ visible: true }).waitFor();
  await page.waitForTimeout(500);
  await shot(page, 'today-hero');
  await button(page, en.home.startWorkout).click();
  await button(page, en.workout.logSet).click();
  await page.getByTestId('rest-ring').waitFor();
  await page.waitForTimeout(500);
  await shot(page, 'rest-ring');
});
