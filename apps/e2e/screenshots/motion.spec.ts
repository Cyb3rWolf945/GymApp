import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { type Page, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { signedInWithPlan } from '../support/app';

// Key shots for the motion and feedback PR: the loading states that replaced spinners, and a button mid-press.
const DIR = process.env.SHOTS_DIR ?? '/tmp/shots';
test.use({ reducedMotion: 'no-preference' });

async function shot(page: Page, name: string) {
  const project = test.info().project.name;
  mkdirSync(join(DIR, project), { recursive: true });
  await page.screenshot({ path: join(DIR, project, `${name}.jpg`), type: 'jpeg', quality: 82 });
}

test('skeletons and a pressed button', async ({ page }) => {
  const backend = await signedInWithPlan(page, { fixedTime: false });

  backend.state.delay.plan_prices = 6000;
  await page.goto('/paywall');
  await page.getByRole('progressbar', { name: en.common.loading }).first().waitFor();
  await page.waitForTimeout(500);
  await shot(page, 'paywall-loading');

  backend.state.delay.plan_prices = 0;
  backend.state.delay.profiles = 6000;
  await page.goto('/profile/goal');
  await page.getByRole('progressbar', { name: en.common.loading }).first().waitFor();
  await page.waitForTimeout(500);
  await shot(page, 'profile-loading');

  backend.state.delay.profiles = 0;
  await page.goto('/');
  const start = page.getByRole('button', { name: en.home.startWorkout, exact: true }).filter({ visible: true }).first();
  await start.waitFor();
  const box = (await start.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(400);
  await shot(page, 'button-pressed');
  await page.mouse.move(box.x + box.width / 2, box.y - 60);
  await page.mouse.up();
});
