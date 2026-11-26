import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { type Page, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { button, chip, signedInWithPlan, start } from '../support/app';

// Key shots for the onboarding showpiece: choice cards, the live target, the plan reveal (reduced motion: no confetti).
const DIR = process.env.SHOTS_DIR ?? '/tmp/shots';
const o = en.onboarding.steps;

async function shot(page: Page, name: string) {
  const project = test.info().project.name;
  mkdirSync(join(DIR, project), { recursive: true });
  await page.screenshot({ path: join(DIR, project, `${name}.jpg`), type: 'jpeg', quality: 80 });
}

test('onboarding showpiece', async ({ page }) => {
  await start(page);
  await page.goto('/onboarding/goal');
  await button(page, en.tracking.reject).click();
  await chip(page, o.goal.options.recomp).click();
  await page.waitForTimeout(400);
  await shot(page, 'goal-cards');
  await button(page, en.common.continue).click();
  await chip(page, o.basics.sex.female).click();
  await button(page, en.common.continue).click();
  await chip(page, o.experience.options.beginner).click();
  await button(page, en.common.continue).click();
  await chip(page, o.availability.weekdays.mon).click();
  await button(page, en.common.continue).click();
  await chip(page, o.equipment.location.gym).click();
  await chip(page, o.equipment.equipment.full_gym).click();
  await button(page, en.common.continue).click();
  await button(page, o.injuries.skip).click();
  await chip(page, o.activity.options.moderate).click();
  await page.waitForTimeout(600);
  await shot(page, 'activity-live-preview');

  await signedInWithPlan(page, { fixedTime: false });
  await page.goto('/preview');
  await page.waitForTimeout(800);
  await shot(page, 'plan-reveal');
});
