import { expect, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { button, shown, signedInWithPlan, start } from '../support/app';

const c = en.paywall.compare;

test('the paywall compares Basic, Pro and Elite, a row per feature, readable as sentences', async ({ page }) => {
  await signedInWithPlan(page);
  await page.goto('/paywall');
  await expect(shown(page, en.paywall.title)).toBeVisible();
  const table = page.getByTestId('plan-comparison').filter({ visible: true }).first();
  await expect(table).toBeVisible();
  await expect(table.getByText(c.title, { exact: true })).toBeVisible();
  const rows = table.getByTestId('compare-row');
  await expect(rows).toHaveCount(c.rows.length);
  for (const row of c.rows) {
    const r = table.getByTestId('compare-row').filter({ hasText: row.label }).first();
    await expect(r).toBeVisible();
    expect((await r.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  }
  // Each row says the same thing in words: Meal plan is Pro and Elite only.
  await expect(table.getByTestId('compare-row').filter({ hasText: 'Meal plan and recipes' }).first()).toHaveAttribute(
    'aria-label',
    `Meal plan and recipes: Basic ${c.notIncluded}, Pro ${c.included}, Elite ${c.included}`,
  );
  await expect(table.getByTestId('compare-row').filter({ hasText: 'Plan generation' }).first()).toHaveAttribute('aria-label', /Basic 1 a month, Pro Any time, Elite Any time, priority/);
  // The plan cards are still there and selectable.
  await expect(page.getByRole('radio').filter({ visible: true })).toHaveCount(3);
});

test('the landing page: a "How it works" strip, the benefits, and no reviews section until there are real reviews', async ({ page }) => {
  await start(page);
  await page.goto('/');
  await expect(shown(page, en.landing.hero)).toBeVisible();
  const how = page.getByTestId('how-it-works').filter({ visible: true }).first();
  await expect(how).toBeVisible();
  await expect(how.getByText(en.landing.how.title, { exact: true })).toBeVisible();
  for (const s of en.landing.how.steps) await expect(how.getByText(s.title, { exact: true })).toBeVisible();
  for (const p of en.landing.points) await expect(shown(page, p.title)).toBeVisible();
  // Nothing is invented: with no real reviews, the section is not drawn.
  await expect(page.getByTestId('reviews')).toHaveCount(0);
  await expect(button(page, en.landing.cta)).toBeVisible();
});
