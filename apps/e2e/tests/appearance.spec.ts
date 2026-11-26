import { expect, test, type Page } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { palettes } from '../../mobile/src/theme/tokens';
import { chip, shown, signedInWithPlan } from '../support/app';

const a = en.appearance;
const state = (page: Page) =>
  page.evaluate(() => ({ scheme: document.documentElement.dataset.scheme, bg: getComputedStyle(document.documentElement).backgroundColor }));
// The page colour comes from the tokens, so a palette change does not need touching here.
const rgb = (hex: string) => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;
const DARK = { scheme: 'dark', bg: rgb(palettes.dark.background) };
const LIGHT = { scheme: 'light', bg: rgb(palettes.light.background) };

test('System is the default and follows the OS live, without a reload', async ({ page }) => {
  await signedInWithPlan(page);
  await page.goto('/settings');
  await expect(shown(page, a.title)).toBeVisible();
  await expect(chip(page, a.options.system)).toBeChecked();
  expect(await state(page)).toEqual(DARK); // the test browser is dark

  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => state(page)).toEqual(LIGHT);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => state(page)).toEqual(DARK);
});

test('Light and Dark override the OS, apply at once and are still there after a reload', async ({ page }) => {
  await signedInWithPlan(page);
  await page.goto('/settings');
  await chip(page, a.options.light).click();
  await expect.poll(() => state(page)).toEqual(LIGHT);

  await page.reload();
  await expect(shown(page, a.title)).toBeVisible();
  await expect(chip(page, a.options.light)).toBeChecked();
  expect(await state(page)).toEqual(LIGHT);

  // Dark wins over a light OS.
  await chip(page, a.options.dark).click();
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => state(page)).toEqual(DARK);

  // Back to System: the (light) OS decides again.
  await chip(page, a.options.system).click();
  await expect.poll(() => state(page)).toEqual(LIGHT);
});

test('the main screens draw with the light palette (the heading uses the light accent, not the dark one)', async ({ page }) => {
  await signedInWithPlan(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(shown(page, en.home.title)).toBeVisible();
  const title = await shown(page, en.home.title).evaluate((el) => getComputedStyle(el).color);
  expect(title).toBe('rgb(63, 98, 18)'); // palettes.light.accent (dark accent is rgb(198, 255, 61))
});
