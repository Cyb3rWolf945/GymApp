import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { type Page, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { chip, signedInWithPlan } from '../support/app';

// Shots for the body map PR: front and back, male and female, dark and light, and the details sheet.
const DIR = process.env.SHOTS_DIR ?? '/tmp/shots';

async function shot(page: Page, name: string, clip = false) {
  const project = test.info().project.name;
  mkdirSync(join(DIR, project), { recursive: true });
  const path = join(DIR, project, `${name}.png`);
  if (clip) await page.locator('svg[aria-label^="Muscle map"]').filter({ visible: true }).first().screenshot({ path });
  else await page.screenshot({ path });
}

test('body map', async ({ page }) => {
  const backend = await signedInWithPlan(page, { fixedTime: false });
  backend.state.history = new Date();
  await page.goto('/progress');
  const map = page.locator('svg[aria-label^="Muscle map"]').filter({ visible: true }).first();
  await map.waitFor();
  await map.scrollIntoViewIfNeeded();
  for (const sex of ['male', 'female']) {
    backend.state.profile = { ...(backend.state.profile ?? {}), sex };
    await page.goto('/progress');
    await map.waitFor();
    await map.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    await shot(page, `${sex}-front`, true);
    await chip(page, en.home.progress.back).filter({ visible: true }).first().click();
    await page.waitForTimeout(1200);
    await shot(page, `${sex}-back`, true);
  }
  await page.goto('/progress');
  await map.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await page.locator('svg path[aria-label^="Pectoralis major"]').first().click();
  await page.waitForTimeout(600);
  await shot(page, 'details-sheet');
});

test('body map, light theme', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fuelift.theme', 'light'));
  const backend = await signedInWithPlan(page, { fixedTime: false });
  backend.state.history = new Date();
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/progress');
  const map = page.locator('svg[aria-label^="Muscle map"]').filter({ visible: true }).first();
  await map.waitFor();
  await map.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await shot(page, 'light-front', true);
});
