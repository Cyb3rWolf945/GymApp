import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { type Page, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { signedInWithPlan } from '../support/app';

// Key shots for the Progress PR: the charts and the muscle map with its key, and the ring colour key on Nutrition.
const DIR = process.env.SHOTS_DIR ?? '/tmp/shots';

async function shot(page: Page, name: string) {
  const project = test.info().project.name;
  mkdirSync(join(DIR, project), { recursive: true });
  await page.screenshot({ path: join(DIR, project, `${name}.jpg`), type: 'jpeg', quality: 80 });
}

test('progress', async ({ page }) => {
  const backend = await signedInWithPlan(page, { fixedTime: false });
  backend.state.history = new Date();
  await page.goto('/progress');
  await page.getByText(en.home.progress.weightTitle, { exact: true }).filter({ visible: true }).first().waitFor();
  await page.getByTestId('bar-chart').filter({ visible: true }).first().waitFor();
  await page.waitForTimeout(1200);
  await shot(page, 'progress-top');
  await page.getByTestId('bar-chart').filter({ visible: true }).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  await shot(page, 'volume');
  await page.getByTestId('heat-legend').filter({ visible: true }).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await shot(page, 'progress-map');
});
