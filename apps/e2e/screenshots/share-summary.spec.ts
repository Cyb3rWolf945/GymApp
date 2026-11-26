import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { type Page, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { button, signedInWithPlan } from '../support/app';

// Key shots for the #138 follow-ups: big set rows, the summary with Share, and the shared card itself.
const DIR = process.env.SHOTS_DIR ?? '/tmp/shots';

async function shot(page: Page, name: string) {
  const project = test.info().project.name;
  mkdirSync(join(DIR, project), { recursive: true });
  await page.screenshot({ path: join(DIR, project, `${name}.jpg`), type: 'jpeg', quality: 80 });
}

test('set rows, summary and the share card', async ({ page }) => {
  await signedInWithPlan(page);
  await button(page, en.home.startWorkout).click();
  for (let i = 0; i < 4; i++) await button(page, 'Increase Weight').click();
  for (let i = 0; i < 3; i++) {
    await button(page, en.workout.logSet).click();
    const skip = button(page, en.workout.skipRest);
    if (await skip.isVisible().catch(() => false)) await skip.click();
  }
  await page.waitForTimeout(500);
  await shot(page, 'set-rows');
  await button(page, en.workout.finish).first().click();
  await page.waitForTimeout(700);
  await shot(page, 'summary-share');
  const download = page.waitForEvent('download');
  await button(page, en.workout.summary.share).click();
  const file = await download;
  const project = test.info().project.name;
  mkdirSync(join(DIR, project), { recursive: true });
  copyFileSync((await file.path())!, join(DIR, project, 'share-card.png'));
});
