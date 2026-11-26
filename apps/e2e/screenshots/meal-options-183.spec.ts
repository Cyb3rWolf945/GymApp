import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { shown, signedInWithPlan } from '../support/app';

// Shots for #183: the option cards under a meal at 600, 820 and 1440 px. `SHOT_TAG` is "before" or "after" the fix.
const DIR = process.env.SHOTS_DIR ?? '/tmp/shots';
const TAG = process.env.SHOT_TAG ?? 'after';
const WIDTHS = [600, 820, 1440] as const;

test('meal option cards by width', async ({ page }) => {
  const backend = await signedInWithPlan(page);
  const nutrition = (backend.state.jobs as { kind: string; result: Record<string, unknown> }[]).find((j) => j.kind === 'nutrition_plan')!;
  nutrition.result = { ...nutrition.result, source: 'template' };
  mkdirSync(DIR, { recursive: true });
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 1180 });
    await page.goto('/');
    await expect(shown(page, en.home.mealsTitle)).toBeVisible();
    const first = page.getByText(en.home.otherOptions, { exact: true }).filter({ visible: true }).first();
    await first.waitFor();
    await page.waitForTimeout(600);
    // The block of cards under the first meal, with a little of the page around it.
    const block = first.locator('xpath=..');
    await block.scrollIntoViewIfNeeded();
    await block.screenshot({ path: join(DIR, `${TAG}-183-${width}.jpg`), type: 'jpeg', quality: 82 });
  }
});
