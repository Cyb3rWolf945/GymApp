import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from '@playwright/test';
import { start } from '../support/app';

// Shots for the cookie banner PR: the banner open on the quiz and the landing page (the content starts below it).
const DIR = process.env.SHOTS_DIR ?? '/tmp/shots';

test('cookie banner open', async ({ page }) => {
  await start(page);
  const project = test.info().project.name;
  mkdirSync(join(DIR, project), { recursive: true });
  for (const [name, path] of [['quiz', '/onboarding/goal'], ['landing', '/']] as const) {
    await page.goto(path);
    await page.waitForTimeout(900);
    await page.screenshot({ path: join(DIR, project, `banner-${name}.jpg`), type: 'jpeg', quality: 65 });
  }
});
