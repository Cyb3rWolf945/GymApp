import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { type Page, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { shown, signedInWithPlan } from '../support/app';

// Key shots for the illustrated states PR: an error, an empty state, a locked screen and a loading skeleton.
const DIR = process.env.SHOTS_DIR ?? '/tmp/shots';

async function shot(page: Page, name: string) {
  const project = test.info().project.name;
  mkdirSync(join(DIR, project), { recursive: true });
  await page.screenshot({ path: join(DIR, project, `${name}.jpg`), type: 'jpeg', quality: 80 });
}

test('states', async ({ page }) => {
  const backend = await signedInWithPlan(page);
  backend.state.failing = ['generation_jobs'];
  await page.goto('/plan');
  await shown(page, en.home.loadError).waitFor();
  await page.waitForTimeout(500);
  await shot(page, 'error');

  backend.state.failing = [];
  await page.goto('/progress');
  await shown(page, en.home.progressEmptyTitle).waitFor();
  await page.waitForTimeout(500);
  await shot(page, 'empty');

  backend.state.entitled = false;
  await page.goto('/nutrition');
  await shown(page, en.nutrition.lockedTitle).waitFor();
  await page.waitForTimeout(500);
  await shot(page, 'locked');

  backend.state.entitled = true;
  backend.state.delay.generation_jobs = 8000;
  await page.goto('/plan');
  await page.getByRole('progressbar', { name: en.common.loading }).first().waitFor();
  await page.waitForTimeout(500);
  await shot(page, 'loading');
});
