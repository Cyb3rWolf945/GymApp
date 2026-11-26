import { expect, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { chip, signedInWithPlan } from '../support/app';

const p = en.home.progress;

async function progress(page: import('@playwright/test').Page) {
  const backend = await signedInWithPlan(page, { fixedTime: false });
  backend.state.history = new Date();
  await page.goto('/progress');
  await expect(page.locator('svg[aria-label^="Muscle map"]').first()).toBeVisible();
  await page.waitForTimeout(900); // the fill animation
  return backend;
}

const map = (page: import('@playwright/test').Page) => page.locator('svg[aria-label^="Muscle map"]').filter({ visible: true }).first();

test('the figure is a body made of curves, with a shape per muscle and the base tone where nothing was trained', async ({ page }) => {
  await progress(page);
  const m = map(page);
  const paths = await m.locator('path').evaluateAll((els) => els.map((e) => ({ d: e.getAttribute('d') ?? '', label: e.getAttribute('aria-label'), opacity: Number(e.getAttribute('fill-opacity') ?? 1), fill: e.getAttribute('fill') })));
  expect(paths.length).toBeLessThan(120);
  for (const x of paths) expect(x.d).not.toMatch(/ L /); // curves only
  expect(paths.some((x) => x.d.includes('C'))).toBe(true);
  // Heat: a trained muscle is brighter than an untrained one (the visible region keeps its fill; labels sit on the tap areas).
  const trained = await page.locator('svg path[aria-label$="this week"]:not([aria-label*=", 0 sets"])').count();
  const untrained = await page.locator('svg path[aria-label*=", 0 sets this week"]').count();
  expect(trained).toBeGreaterThan(0);
  expect(untrained).toBeGreaterThan(0);
  const opacities = paths.filter((x) => x.fill && x.fill !== 'transparent' && x.label === null && x.opacity < 1).map((x) => x.opacity);
  expect(opacities.some((o) => o === 0.6)).toBe(true); // empty regions: base tone
  expect(Math.max(...paths.filter((x) => x.label === null).map((x) => x.opacity))).toBeGreaterThan(0.6);
});

test('Front and Back switch the muscles shown', async ({ page }) => {
  await progress(page);
  await expect(page.locator('svg path[aria-label^="Pectoralis major"]').first()).toBeAttached();
  await expect(page.locator('svg path[aria-label^="Latissimus dorsi"]')).toHaveCount(0);
  await chip(page, p.back).filter({ visible: true }).first().click();
  await expect(page.locator('svg path[aria-label^="Latissimus dorsi"]').first()).toBeAttached();
  await expect(page.locator('svg path[aria-label^="Pectoralis major"]')).toHaveCount(0);
});

test('tapping a muscle highlights it and opens its details, with the exercises linking to the exercise', async ({ page }) => {
  await progress(page);
  await page.locator('svg path[aria-label^="Pectoralis major"]').first().click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('Pectoralis major');
  await expect(sheet).toContainText(p.sheetWeekly);
  await expect(sheet).toContainText(p.sheetTop);
  const link = sheet.getByRole('button').filter({ hasText: /sets?$/ }).first();
  await link.click();
  await expect(page).toHaveURL(/\/exercise\//);
});

test('the key shows the bands, and 30 days is a weekly average', async ({ page }) => {
  await progress(page);
  const legend = page.getByTestId('heat-legend').filter({ visible: true }).first();
  await expect(legend).toContainText(p.legendTitle);
  for (const label of ['0', '1–4', '5–9', '10–20', '20+']) await expect(legend).toContainText(label);
  await chip(page, p.period30).filter({ visible: true }).first().click();
  await expect(page.getByText(p.mapTitle30, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await chip(page, p.period7).filter({ visible: true }).first().click();
  await expect(page.getByText(p.mapTitle, { exact: true }).filter({ visible: true }).first()).toBeVisible();
});

test('each body, male, female and neutral, draws the same muscles', async ({ page }) => {
  const backend = await progress(page);
  const labels = async () => page.locator('svg path[aria-label$="this week"]').evaluateAll((els) => els.map((e) => (e.getAttribute('aria-label') ?? '').split(',')[0]));
  const neutral = await labels();
  expect(neutral.length).toBeGreaterThan(10);
  for (const sex of ['male', 'female']) {
    backend.state.profile = { ...(backend.state.profile ?? {}), sex };
    await page.goto('/progress');
    await expect(map(page)).toBeVisible();
    await page.waitForTimeout(500);
    expect(await labels()).toEqual(neutral);
  }
});
