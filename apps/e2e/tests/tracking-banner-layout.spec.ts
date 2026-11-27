import { expect, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { button, chip, start } from '../support/app';

// QA #176: the cookie banner is part of the page flow, so it never covers the first screen (it did, at the top of the page).
const o = en.onboarding.steps;

const banner = (page: import('@playwright/test').Page) => page.getByRole('alert').filter({ hasText: en.tracking.title }).first();

async function bottomOfBanner(page: import('@playwright/test').Page): Promise<number> {
  await expect(banner(page)).toBeVisible();
  const box = (await banner(page).boundingBox())!;
  return box.y + box.height;
}

test('with the banner open, the first screens start below it: landing, quiz and sign-in', async ({ page }) => {
  await start(page);
  for (const [path, text] of [['/', en.landing.hero], ['/onboarding/goal', o.goal.title], ['/sign-in', null]] as const) {
    await page.goto(path);
    const below = await bottomOfBanner(page);
    // The page's first heading (or the named text) starts at or below the bottom of the banner.
    const target = text ? page.getByText(text, { exact: true }).filter({ visible: true }).first() : page.getByRole('heading').filter({ visible: true }).first();
    await expect(target).toBeVisible();
    const box = (await target.boundingBox())!;
    expect(box.y + 1, `${path}: ${text ?? 'heading'} under the banner`).toBeGreaterThanOrEqual(below);
  }
});

test('with the banner open, the Experience answer can be clicked, and Reject still works and is remembered', async ({ page }) => {
  await start(page);
  await page.goto('/onboarding/experience');
  await bottomOfBanner(page);
  await chip(page, o.experience.options.beginner).click(); // no "subtree intercepts pointer events"
  await expect(chip(page, o.experience.options.beginner)).toBeChecked();
  await button(page, en.tracking.reject).click();
  await expect(banner(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(o.experience.title, { exact: false }).filter({ visible: true }).first()).toBeVisible();
  await expect(banner(page)).toHaveCount(0); // the choice is remembered
});

test('on a phone held sideways (844 x 390) the banner is compact and the quiz question and first answer stay reachable', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await start(page);
  await page.goto('/onboarding/goal');
  await bottomOfBanner(page);
  const box = (await banner(page).boundingBox())!;
  expect(box.height, 'a compact row, not more than a third of the screen').toBeLessThan(390 / 3);
  // The policy link, Reject and Accept are all there.
  await expect(page.getByRole('link', { name: en.tracking.privacy }).first()).toBeVisible();
  await expect(button(page, en.tracking.reject)).toBeVisible();
  await expect(button(page, en.tracking.accept)).toBeVisible();
  // The question is reachable (by scrolling if need be) and the first answer can be clicked, without dismissing the banner.
  const title = page.getByText(o.goal.title, { exact: true }).filter({ visible: true }).first();
  // Without scrolling: the footer scrolls with the content on a short screen, so the question is already on screen.
  await expect(title).toBeInViewport({ ratio: 1 });
  await chip(page, o.goal.options.cut).scrollIntoViewIfNeeded();
  await chip(page, o.goal.options.cut).click();
  await expect(chip(page, o.goal.options.cut)).toBeChecked();
  await expect(banner(page)).toBeVisible(); // still open: nothing had to be dismissed
});
