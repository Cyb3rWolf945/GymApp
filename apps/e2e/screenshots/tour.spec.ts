import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { type Page, test } from '@playwright/test';
import { FIXED_NOW, signedInWithPlan, start } from '../support/app';

// A tour of the main screens for before/after comparisons in design PRs. Files: <SHOTS_DIR>/<project>/<name>.jpg.
const DIR = process.env.SHOTS_DIR ?? '/tmp/shots';

async function shot(page: Page, name: string) {
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(700);
  const project = test.info().project.name;
  mkdirSync(join(DIR, project), { recursive: true });
  await page.screenshot({ path: join(DIR, project, `${name}.jpg`), type: 'jpeg', quality: 82 });
}

test('signed out: landing, quiz and sign-in', async ({ page }) => {
  await start(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Reject', exact: true }).click().catch(() => {});
  await shot(page, '01-landing');
  await page.goto('/onboarding/goal');
  await shot(page, '02-quiz-goal');
  await page.goto('/sign-in');
  await shot(page, '03-sign-in');
});

test('signed in: the tabs, the recipe and the paywall', async ({ page }) => {
  const backend = await signedInWithPlan(page);
  backend.state.history = FIXED_NOW;
  const tabs: [string, string][] = [['04-today', '/'], ['05-plan', '/plan'], ['06-nutrition', '/nutrition'], ['07-progress', '/progress'], ['08-settings', '/settings'], ['09-recipe', '/recipe/oats-and-berries'], ['10-paywall', '/paywall']];
  for (const [name, path] of tabs) {
    await page.goto(path);
    await shot(page, name);
  }
});
