import { expect, test, type Page } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { MIN_TAP_TARGET } from '../../mobile/src/theme/tokens';
import { button, shown, signedInWithPlan, start } from '../support/app';
import { ownViewports } from '../support/projects';

const WIDTHS = [320, 375, 600, 768, 1024, 1440, 1920];
/** The page must not scroll sideways: nothing wider than the window. */
const overflowX = (page: Page) => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);

async function noSidewaysScroll(page: Page, route: string, ready: () => Promise<unknown>) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(route);
    await ready();
    await page.waitForTimeout(200);
    expect(await overflowX(page), `${route} at ${width}px`).toBeLessThanOrEqual(0);
  }
}

ownViewports();

test.describe('responsive flows', () => {
  test('signed-out screens never scroll sideways, 320 to 1920 px', async ({ page }) => {
    await start(page);
    await noSidewaysScroll(page, '/', () => expect(button(page, en.landing.cta)).toBeVisible());
    await noSidewaysScroll(page, '/sign-in', () => expect(page.getByPlaceholder('you@example.com').or(page.getByRole('textbox')).first()).toBeVisible());
    await noSidewaysScroll(page, '/onboarding/goal', () => expect(button(page, en.common.continue)).toBeVisible());
    await noSidewaysScroll(page, '/legal/terms', () => expect(button(page, en.home.legal.back)).toBeVisible());
  });

  test('signed-in screens never scroll sideways, 320 to 1920 px', async ({ page }) => {
    await signedInWithPlan(page);
    await noSidewaysScroll(page, '/paywall', () => expect(shown(page, en.paywall.title)).toBeVisible());
    await noSidewaysScroll(page, '/shopping', () => expect(shown(page, en.nutrition.shopping.title)).toBeVisible());
    await noSidewaysScroll(page, '/memory', () => expect(shown(page, en.home.memory.title)).toBeVisible());
    await noSidewaysScroll(page, '/recipe/oats-and-berries', () => expect(shown(page, 'Oats and berries', false)).toBeVisible());
    await noSidewaysScroll(page, '/preview', () => expect(shown(page, en.plan.preview.title)).toBeVisible());
  });

  test('landing: the button is on screen without scrolling, and the page is two columns on desktop', async ({ page }) => {
    await start(page);
    for (const [width, height] of [[1440, 900], [375, 812]] as const) {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      const cta = button(page, en.landing.cta);
      await expect(cta).toBeVisible();
      const box = (await cta.boundingBox())!;
      expect(box.y + box.height, `${width}x${height}: CTA above the fold`).toBeLessThanOrEqual(height);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const cta = (await button(page, en.landing.cta).boundingBox())!;
    const benefit = (await shown(page, en.landing.points[0].title).boundingBox())!;
    expect(benefit.x, 'benefits sit to the right of the pitch').toBeGreaterThan(cta.x + cta.width);
  });

  test('onboarding and sign-in: a centred card on desktop, with the progress bar and buttons on screen', async ({ page }) => {
    await start(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/onboarding/goal');
    const progress = page.getByRole('progressbar').first();
    await expect(progress).toBeVisible();
    const box = (await progress.boundingBox())!;
    expect(box.width, 'reading width').toBeLessThanOrEqual(720);
    expect(Math.abs(box.x + box.width / 2 - 720), 'centred').toBeLessThan(40);
    await expect(button(page, en.common.continue)).toBeVisible();

    await page.goto('/sign-in');
    const send = shown(page, 'Send magic link', false);
    await expect(send).toBeVisible();
    const s = (await send.boundingBox())!;
    expect(Math.abs(s.x + s.width / 2 - 720), 'sign-in centred').toBeLessThan(40);
  });

  test('paywall: tiers side by side from 768 px, stacked on phones', async ({ page }) => {
    await signedInWithPlan(page);
    const names = [en.paywall.plans.basic.name, en.paywall.plans.pro.name, en.paywall.plans.elite.name];
    // Rows, not exact pixels: the Pro card has a "Most popular" label that shifts its title by a few pixels.
    const rows = async () => {
      const ys = await Promise.all(names.map(async (n) => (await shown(page, n).boundingBox())!.y));
      return Math.max(...ys) - Math.min(...ys) < 30 ? 1 : 3;
    };
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/paywall');
    await expect(shown(page, names[0])).toBeVisible();
    expect(await rows(), 'phone: stacked').toBe(3);
    for (const width of [768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(rows, `${width}px: one row`).toBe(1);
    }
  });

  test('recipe: ingredients and steps in two columns on desktop', async ({ page }) => {
    await signedInWithPlan(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/recipe/oats-and-berries');
    const ing = shown(page, en.nutrition.recipe.ingredients);
    const steps = shown(page, en.nutrition.recipe.steps);
    await expect(steps).toBeVisible();
    await expect.poll(async () => (await steps.boundingBox())!.x).toBeGreaterThan((await ing.boundingBox())!.x + 200);
    await page.setViewportSize({ width: 390, height: 900 });
    await expect.poll(async () => (await steps.boundingBox())!.y).toBeGreaterThan((await ing.boundingBox())!.y);
  });

  test('workout logger: logged sets next to the set panel on desktop, tap targets stay at least 48 px', async ({ page }) => {
    await signedInWithPlan(page);
    await button(page, en.home.startWorkout).click();
    await expect(page).toHaveURL(/\/workout/);
    await button(page, en.workout.logSet).click();
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const log = button(page, en.workout.logSet);
      await expect(log).toBeVisible();
      expect((await log.boundingBox())!.height, `${width}px: Log set`).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
      const skip = button(page, en.workout.skipRest);
      if (await skip.isVisible().catch(() => false)) expect((await skip.boundingBox())!.height, `${width}px: Skip rest`).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
      expect(await overflowX(page), `workout at ${width}px`).toBeLessThanOrEqual(0);
    }
    const logged = shown(page, en.workout.loggedTitle);
    await expect.poll(async () => (await logged.boundingBox())!.x).toBeGreaterThan((await log0(page)).x + 200);
  });
});

const log0 = async (page: Page) => (await button(page, en.workout.logSet).boundingBox())!;
