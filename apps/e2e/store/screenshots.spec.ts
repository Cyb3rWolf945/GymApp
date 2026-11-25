import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { FIXED_NOW, button, shown, signedInWithPlan } from '../support/app';

// One screenshot per store slot, in the order they should appear in the listing.
const SHOTS: { file: string; path: string; ready: (page: import('@playwright/test').Page) => Promise<void> }[] = [
  { file: '01-today', path: '/', ready: (p) => expect(button(p, en.home.startWorkout)).toBeVisible() },
  { file: '02-plan', path: '/plan', ready: (p) => expect(shown(p, 'Barbell back squat', false)).toBeVisible() },
  { file: '03-meals', path: '/nutrition', ready: (p) => expect(shown(p, en.nutrition.swapNote, false)).toBeVisible() },
  { file: '04-recipe', path: '/recipe/chicken-rice-bowl?portions=1', ready: (p) => expect(shown(p, 'Chicken breast', false)).toBeVisible() },
  { file: '05-shopping-list', path: '/shopping', ready: (p) => expect(shown(p, 'Rolled oats')).toBeVisible() },
  { file: '06-progress', path: '/progress', ready: (p) => expect(shown(p, en.home.progress.prsTitle)).toBeVisible() },
];

test('store screenshots', async ({ page }, info) => {
  const backend = await signedInWithPlan(page);
  backend.state.history = FIXED_NOW; // weights, sets and workouts for the Progress screen
  const dir = join(__dirname, 'screenshots', info.project.name);
  mkdirSync(dir, { recursive: true });

  for (const shot of SHOTS) {
    await page.goto(shot.path);
    await shot.ready(page);
    await page.waitForTimeout(600); // let charts and fonts settle
    await page.screenshot({ path: join(dir, `${shot.file}.png`) });
    console.log(`${info.project.name}/${shot.file}.png`);
  }
});
