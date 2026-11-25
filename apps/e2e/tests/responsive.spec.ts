import { expect, test, type Page } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { MIN_TAP_TARGET, SIDE_NAV_WIDTH } from '../../mobile/src/theme/tokens';
import { signedInWithPlan } from '../support/app';

const TABS = [en.home.tabs.today, en.home.tabs.plan, en.home.tabs.nutrition, en.home.tabs.progress, en.home.tabs.settings];

/** Position and size of each of the five tabs on screen. */
/** Number of distinct rows the tabs are in: 1 = a bottom bar, 5 = a side column. Waits for a resize to settle. */
const rowsOf = async (page: Page) => new Set((await tabBoxes(page)).map((b) => Math.round(b.y))).size;

async function tabBoxes(page: Page) {
  const boxes = [];
  for (const name of TABS) {
    const tab = page.getByRole('tab', { name, exact: true });
    await expect(tab, name).toBeVisible();
    boxes.push({ name, ...(await tab.boundingBox())! });
  }
  return boxes;
}

test.describe('responsive navigation', () => {
  test('phones keep the bottom tab bar', async ({ page }) => {
    await signedInWithPlan(page);
    await page.setViewportSize({ width: 390, height: 844 });
    const boxes = await tabBoxes(page);
    // One row along the bottom edge: same y, left to right, all in the bottom 100 px.
    expect(new Set(boxes.map((b) => Math.round(b.y))).size).toBe(1);
    expect(boxes.map((b) => b.x)).toEqual([...boxes.map((b) => b.x)].sort((a, b) => a - b));
    expect(boxes[0].y).toBeGreaterThan(844 - 100);
    for (const b of boxes) expect(b.height, b.name).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
  });

  test('tablets and desktop get a left side navigation with the same five tabs and labels', async ({ page }) => {
    await signedInWithPlan(page);
    for (const [width, rail] of [[768, SIDE_NAV_WIDTH.medium], [1280, SIDE_NAV_WIDTH.expanded]] as const) {
      await page.setViewportSize({ width, height: 900 });
      const boxes = await tabBoxes(page);
      // One column on the left edge: same x inside the rail, stacked top to bottom.
      expect(Math.max(...boxes.map((b) => b.x)), `${width}px: tabs start at the left edge`).toBeLessThan(rail);
      expect(Math.max(...boxes.map((b) => b.x + b.width)), `${width}px: tabs fit inside the rail`).toBeLessThanOrEqual(rail + 1);
      expect(boxes.map((b) => b.y)).toEqual([...boxes.map((b) => b.y)].sort((a, b) => a - b));
      expect(new Set(boxes.map((b) => Math.round(b.y))).size, `${width}px: stacked, not in one row`).toBe(5);
      for (const b of boxes) expect(b.height, `${width}px ${b.name}`).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
    }
  });

  test('switches layout when the window is resized, without a reload, and the active tab stays visible', async ({ page }) => {
    await signedInWithPlan(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await tabBoxes(page);
    let reloads = 0;
    page.on('load', () => reloads++);

    await page.setViewportSize({ width: 1100, height: 900 });
    await expect.poll(() => rowsOf(page)).toBe(5); // now a column

    // Exact edges: 599 is a bottom bar, 600 a side navigation.
    await page.setViewportSize({ width: 599, height: 900 });
    await expect.poll(() => rowsOf(page)).toBe(1);
    await page.setViewportSize({ width: 600, height: 900 });
    await expect.poll(() => rowsOf(page)).toBe(5);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => rowsOf(page)).toBe(1);
    expect(reloads).toBe(0);

    // Navigation still works in the rail and shows where you are.
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.getByRole('tab', { name: en.home.tabs.plan, exact: true }).click();
    await expect(page).toHaveURL(/\/plan/);
    await expect(page.getByRole('tab', { name: en.home.tabs.plan, exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: en.home.tabs.today, exact: true })).toHaveAttribute('aria-selected', 'false');
  });
});
