import { expect, test, type Page } from '@playwright/test';
import { STEP_IDS } from '../../../packages/shared/src/onboarding/flow';
import { en } from '../../mobile/src/copy/en';
import { MIN_TAP_TARGET, SIDE_NAV_WIDTH } from '../../mobile/src/theme/tokens';
import { button, shown, signedInWithPlan, start } from '../support/app';
import { SIZES, type ProjectName } from '../support/projects';

// Runs in the `phone`, `tablet` and `desktop` projects (playwright.config.ts): the window size comes from the project.
// Width sweeps and live resizing are in responsive-tabs, responsive-flows and responsive-resize (desktop project only).

const project = () => test.info().project.name as ProjectName;
const TABS = [en.home.tabs.today, en.home.tabs.plan, en.home.tabs.nutrition, en.home.tabs.progress, en.home.tabs.settings];

/** No sideways scrolling: the document is not wider than the window. */
async function expectNoOverflow(page: Page, what: string) {
  await page.waitForTimeout(200); // let a layout pass settle
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(scroll, `${what}: scrollWidth ${scroll} > clientWidth ${client}`).toBeLessThanOrEqual(client);
}

test.describe('no horizontal overflow', () => {
  test('landing, quiz funnel (every step), sign-in and onboarding step 1', async ({ page }) => {
    await start(page);
    await page.goto('/');
    await expect(button(page, en.landing.cta)).toBeVisible();
    await expectNoOverflow(page, 'landing');

    await page.goto('/sign-in');
    await expect(page.getByRole('textbox').first()).toBeVisible();
    await expectNoOverflow(page, 'sign-in');

    // Step 1 is the welcome screen; the rest of the quiz is the funnel.
    for (const id of STEP_IDS) {
      await page.goto(`/onboarding/${id}`);
      await expect(page.getByRole('button').first()).toBeVisible();
      await expectNoOverflow(page, `onboarding/${id}`);
    }
  });

  test('Today, Plan, Nutrition, Progress, Settings, paywall and shopping list', async ({ page }) => {
    await signedInWithPlan(page);
    await expect(shown(page, en.home.title)).toBeVisible();
    await expectNoOverflow(page, 'Today');
    for (const [tab, label] of [[en.home.tabs.plan, 'Plan'], [en.home.tabs.nutrition, 'Nutrition'], [en.home.tabs.progress, 'Progress'], [en.home.tabs.settings, 'Settings']] as const) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      await expect(page.getByRole('tab', { name: tab, exact: true })).toHaveAttribute('aria-selected', 'true');
      await expectNoOverflow(page, label);
    }
    await page.goto('/paywall');
    await expect(shown(page, en.paywall.title)).toBeVisible();
    await expectNoOverflow(page, 'paywall');
    await page.goto('/shopping');
    await expect(shown(page, en.nutrition.shopping.title)).toBeVisible();
    await expectNoOverflow(page, 'shopping list');
  });
});

test.describe('navigation', () => {
  test('bottom tab bar on phone, side navigation on tablet and desktop', async ({ page }) => {
    await signedInWithPlan(page);
    const boxes = [];
    for (const name of TABS) {
      const tab = page.getByRole('tab', { name, exact: true });
      await expect(tab, name).toBeVisible();
      boxes.push({ name, ...(await tab.boundingBox())! });
      expect(boxes[boxes.length - 1].height, `${name}: tap target`).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
    }
    const rows = new Set(boxes.map((b) => Math.round(b.y))).size;
    if (project() === 'phone') {
      expect(rows, 'phone: one row').toBe(1);
      expect(boxes[0].y, 'phone: along the bottom edge').toBeGreaterThan(SIZES.phone.height - 100);
    } else {
      expect(rows, `${project()}: stacked in a column`).toBe(5);
      const rail = project() === 'tablet' ? SIDE_NAV_WIDTH.medium : SIDE_NAV_WIDTH.expanded;
      expect(Math.max(...boxes.map((b) => b.x + b.width)), `${project()}: inside the left rail`).toBeLessThanOrEqual(rail + 1);
    }
  });
});

test.describe('landing', () => {
  test('the main button is inside the first viewport', async ({ page }) => {
    await start(page);
    await page.goto('/');
    const cta = button(page, en.landing.cta);
    await expect(cta).toBeVisible();
    const box = (await cta.boundingBox())!;
    const { width, height } = SIZES[project()];
    expect(box.y + box.height, `${project()} ${width}x${height}: button bottom edge`).toBeLessThanOrEqual(height);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
  });
});
