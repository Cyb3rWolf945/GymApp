import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { type Page, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { button, shown, signedInWithPlan, start } from '../support/app';

// Key shots for the Paywall and landing PR: the landing page, and the plan comparison table on the paywall.
const DIR = process.env.SHOTS_DIR ?? '/tmp/shots';

async function shot(page: Page, name: string, fullPage = false) {
  const project = test.info().project.name;
  mkdirSync(join(DIR, project), { recursive: true });
  await page.screenshot({ path: join(DIR, project, `${name}.jpg`), type: 'jpeg', quality: 80, fullPage });
}

test('landing and paywall', async ({ page }) => {
  await start(page);
  await page.goto('/');
  await shown(page, en.landing.hero).waitFor();
  await button(page, en.tracking.reject).click();
  await page.getByTestId('how-it-works').filter({ visible: true }).first().waitFor();
  await page.waitForTimeout(900);
  await shot(page, 'landing');
  await page.getByTestId('how-it-works').filter({ visible: true }).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await shot(page, 'landing-how');

  await signedInWithPlan(page);
  await page.goto('/paywall');
  await shown(page, en.paywall.title).waitFor();
  await page.getByTestId('plan-comparison').filter({ visible: true }).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await shot(page, 'paywall-compare');
});
