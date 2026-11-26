import { type Page, expect, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { signedInWithPlan, start } from '../support/app';

// E-72: `react-native-svg` put responder props on DOM paths on the web (React warned, and the muscle taps did nothing).
// React's unknown-prop warnings are console errors; collect them while visiting the screens.
const BAD = /Unknown event handler property|React does not recognize|Invalid DOM property|Unknown prop/;

function collect(page: Page): string[] {
  const bad: string[] = [];
  page.on('console', (m) => {
    if (BAD.test(m.text())) bad.push(m.text());
  });
  page.on('pageerror', (e) => {
    if (BAD.test(e.message)) bad.push(e.message);
  });
  return bad;
}

test('signed out: landing, quiz and sign-in print no unknown-prop warnings', async ({ page }) => {
  const bad = collect(page);
  await start(page);
  for (const path of ['/', '/onboarding/welcome', '/onboarding/goal', '/sign-in', '/sign-in?mode=login']) {
    await page.goto(path);
    await page.waitForTimeout(400);
  }
  expect(bad).toEqual([]);
});

test('signed in: every main screen prints no unknown-prop warnings, and a muscle opens by click and by keyboard', async ({ page }) => {
  const bad = collect(page);
  const backend = await signedInWithPlan(page, { fixedTime: false });
  backend.state.history = new Date();
  for (const path of ['/', '/plan', '/workout', '/nutrition', '/shopping', '/paywall', '/profile']) {
    await page.goto(path);
    await page.waitForTimeout(400);
  }

  await page.goto('/progress');
  // Muscles trained this week (the ones with details to show), not the empty regions.
  const muscles = page.locator('svg path[aria-label$="this week"]:not([aria-label*=", 0 sets"])');
  await expect(muscles.first()).toBeVisible();
  expect(await page.locator('svg button').count()).toBe(0); // regions stay SVG paths
  await expect(muscles.first()).toHaveAttribute('tabindex', '0');

  // Click: the details open.
  await muscles.first().click();
  const sheet = page.getByRole('dialog').filter({ hasText: en.home.progress.detail.setsWeek });
  await expect(sheet).toBeVisible();
  await page.goto('/progress');
  await expect(sheet).toBeHidden();

  // Keyboard: Tab can reach a muscle, Enter opens it.
  await muscles.nth(1).focus();
  await page.keyboard.press('Enter');
  await expect(sheet).toBeVisible();

  expect(bad).toEqual([]);
});
