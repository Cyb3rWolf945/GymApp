import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { type Page, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { button, shown, signedInWithPlan } from '../support/app';

// Shots for the meal options PR (E-71): Today with "Other options", the "See more" sheet, light and dark.
const DIR = process.env.SHOTS_DIR ?? '/tmp/shots';

async function shot(page: Page, name: string) {
  const project = test.info().project.name;
  mkdirSync(join(DIR, project), { recursive: true });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(DIR, project, `${name}.jpg`), type: 'jpeg', quality: 65 });
}

for (const scheme of ['dark', 'light'] as const) {
  test(`meal options, ${scheme}`, async ({ page }) => {
    await page.addInitScript((s) => localStorage.setItem('fuelift.theme', s), scheme);
    await page.emulateMedia({ colorScheme: scheme });
    const backend = await signedInWithPlan(page);
    const nutrition = (backend.state.jobs as { kind: string; result: Record<string, unknown> }[]).find((j) => j.kind === 'nutrition_plan')!;
    nutrition.result = { ...nutrition.result, source: 'template' };
    await page.goto('/');
    await shown(page, en.home.otherOptions).scrollIntoViewIfNeeded();
    await shot(page, `${scheme}-today-options`);
    await button(page, en.home.seeMore).filter({ visible: true }).first().click();
    await shot(page, `${scheme}-see-more`);
  });
}
