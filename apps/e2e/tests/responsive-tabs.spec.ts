import { expect, test, type Page } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { FIXED_NOW, signedInWithPlan } from '../support/app';
import { ownViewports } from '../support/projects';

const TABS = [en.home.tabs.today, en.home.tabs.plan, en.home.tabs.nutrition, en.home.tabs.progress, en.home.tabs.settings];
const WIDTHS = [320, 390, 600, 768, 1024, 1366, 1920];

const openTab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true }).click();
/** The page must not scroll sideways: nothing wider than the window. */
const overflowX = (page: Page) => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);

ownViewports();

test.describe('responsive main tabs', () => {
  test('no horizontal scrolling on any tab from 320 to 1920 px', async ({ page }) => {
    await signedInWithPlan(page);
    for (const tab of TABS) {
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await openTab(page, tab);
        await expect(page.getByRole('tab', { name: tab, exact: true })).toHaveAttribute('aria-selected', 'true');
        await page.waitForTimeout(150);
        expect(await overflowX(page), `${tab} at ${width}px`).toBeLessThanOrEqual(0);
      }
    }
  });

  test('Today: workout and meals are side by side from 600 px, stacked on phones', async ({ page }) => {
    await signedInWithPlan(page);
    const workout = page.getByText(en.home.startWorkout, { exact: true }).filter({ visible: true }).first();
    const meals = page.getByText(en.home.mealsTitle, { exact: true }).filter({ visible: true }).first();
    await page.setViewportSize({ width: 390, height: 900 });
    await expect(workout).toBeVisible();
    const phone = { w: (await workout.boundingBox())!, m: (await meals.boundingBox())! };
    expect(phone.m.y, 'phone: meals below the workout').toBeGreaterThan(phone.w.y);

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect.poll(async () => Math.abs((await meals.boundingBox())!.y - (await page.getByText(en.home.workoutMeta(2, 15), { exact: false }).filter({ visible: true }).first().boundingBox())!.y)).toBeLessThan(80);
    expect((await meals.boundingBox())!.x, 'desktop: meals to the right of the workout').toBeGreaterThan((await workout.boundingBox())!.x + 100);
  });

  test('Exercise screen: "Swap exercise" is a bottom sheet on phones and a capped, centred dialog on desktop', async ({ page }) => {
    await signedInWithPlan(page);
    // "Swap exercise" lives on the exercise screen (E-51): open it from the plan (fresh load: earlier tabs stay mounted behind).
    await page.goto('/plan');
    await page.getByRole('button', { name: /Barbell bench press/ }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/exercise\/barbell-bench-press/);
    const close = page.getByRole('button', { name: en.common.close, exact: true });
    const swap = page.getByText(en.home.swap.action, { exact: true }).filter({ visible: true }).first();
    const heading = () => page.getByText(en.home.swap.body, { exact: true }).filter({ visible: true }).first();

    await page.setViewportSize({ width: 390, height: 844 });
    await swap.click();
    await expect(heading()).toBeVisible();
    expect((await heading().boundingBox())!.y, 'phone: sheet content sits low on the screen').toBeGreaterThan(844 / 3);
    await close.click({ force: true });
    await expect(heading()).toBeHidden();

    await page.setViewportSize({ width: 1366, height: 900 });
    await swap.click();
    await expect(heading()).toBeVisible();
    // Measured once the dialog has stopped moving (it fades in), never from a single early reading.
    const geometry = async () => {
      const box = await heading().boundingBox();
      return box ? { width: box.width, centre: box.x + box.width / 2, top: box.y } : null;
    };
    await expect.poll(async () => (await geometry())?.width ?? 9999, 'desktop: dialog is capped').toBeLessThanOrEqual(520);
    await expect.poll(async () => Math.abs(((await geometry())?.centre ?? 0) - 1366 / 2), 'desktop: horizontally centred').toBeLessThan(60);
    await expect.poll(async () => (await geometry())?.top ?? 9999, 'desktop: not stuck to the bottom').toBeLessThan(900 / 2);
  });

  test('Progress: the chart redraws at the new width', async ({ page }) => {
    const backend = await signedInWithPlan(page);
    backend.state.history = FIXED_NOW; // weigh-ins from the last weeks, so there is a chart to measure
    await openTab(page, en.home.tabs.progress);
    // Found by its accessible name, not by position: "the first visible image" can be a different element after a resize.
    const chart = page.getByRole('img', { name: /Line chart of your 7-day average weight/ });
    const width = async () => (await chart.boundingBox())?.width ?? 0;

    await page.setViewportSize({ width: 390, height: 900 });
    await expect(chart).toBeVisible();
    await expect.poll(width).toBeGreaterThan(100);
    const narrow = await width();

    await page.setViewportSize({ width: 1366, height: 900 });
    await expect.poll(width).toBeGreaterThan(narrow + 100);
  });
});
