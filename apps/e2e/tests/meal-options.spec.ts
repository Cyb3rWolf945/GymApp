import { expect, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { button, shown, signedInWithPlan } from '../support/app';

const t = en.home;

/** A template meal plan (starter note and all), signed in, on Today (a Monday: a training day). */
async function today(page: import('@playwright/test').Page) {
  const backend = await signedInWithPlan(page);
  const nutrition = (backend.state.jobs as { kind: string; result: Record<string, unknown> }[]).find((j) => j.kind === 'nutrition_plan')!;
  nutrition.result = { ...nutrition.result, source: 'template' };
  await page.goto('/');
  await expect(shown(page, t.mealsTitle)).toBeVisible();
  return backend;
}

const optionCards = (page: import('@playwright/test').Page) => page.getByRole('button', { name: /^Use .*\. \d+\skcal/ }).filter({ visible: true });

test('each meal shows 2 or 3 other options, with kcal and protein; picking one changes the meal, the totals and the shopping list', async ({ page }) => {
  const backend = await today(page);
  await expect(shown(page, t.otherOptions)).toBeVisible();
  const first = optionCards(page);
  await expect.poll(() => first.count()).toBeGreaterThanOrEqual(2);
  expect(await first.count()).toBeLessThanOrEqual(9); // three meals, up to three options each
  await expect(page.getByText(/\d+\skcal · \d+\sg\sprotein/).filter({ visible: true }).first()).toBeVisible();

  // Breakfast options are breakfast recipes only.
  const breakfastOption = page.getByRole('button', { name: /^Use (Greek yogurt bowl|Eggs on toast|Protein pancakes)/ }).filter({ visible: true }).first();
  await expect(breakfastOption).toBeVisible();
  const name = (await breakfastOption.getAttribute('aria-label'))!.replace(/^Use /, '').split('. ')[0];
  await breakfastOption.click();

  // The card shows the new meal; a swap row was recorded against the plan.
  await expect(page.getByText(new RegExp(`${name} · \\d+ kcal`)).filter({ visible: true }).first()).toBeVisible();
  expect(backend.state.mealSwaps).toHaveLength(1);
  expect(backend.state.mealSwaps[0]).toMatchObject({ from_slug: 'oats-and-berries', day_index: 0, meal_index: 0 });
  await expect(shown(page, t.swappedTo(name))).toBeVisible();

  // The shopping list follows the new meal.
  await page.goto('/shopping');
  const swapped = backend.state.mealSwaps[0] as { to_slug: string };
  expect(swapped.to_slug).not.toBe('oats-and-berries');
  await expect(page.getByText(/Rolled oats/).filter({ visible: true })).toHaveCount(0);
});

test('Undo brings the previous meal back', async ({ page }) => {
  const backend = await today(page);
  await expect(optionCards(page).first()).toBeVisible();
  await optionCards(page).first().click();
  await expect.poll(() => backend.state.mealSwaps.length).toBe(1);
  await button(page, t.undoSwap).filter({ visible: true }).first().click();
  await expect.poll(() => backend.state.mealSwaps.length).toBe(0);
  await expect(shown(page, t.undoneSwap)).toBeVisible();
  await expect(page.getByText(/Oats and berries · \d+ kcal/).filter({ visible: true }).first()).toBeVisible();
});

test('swapping a meal that was marked as eaten clears "eaten" for it and says so', async ({ page }) => {
  await today(page);
  await page.getByRole('button', { name: new RegExp(`Breakfast.*${t.markEaten}`) }).filter({ visible: true }).first().click();
  await expect(page.getByText(t.unmarkEaten).filter({ visible: true }).first()).toBeVisible();
  const breakfastOption = page.getByRole('button', { name: /^Use (Greek yogurt bowl|Eggs on toast|Protein pancakes)/ }).filter({ visible: true }).first();
  const name = (await breakfastOption.getAttribute('aria-label'))!.replace(/^Use /, '').split('. ')[0];
  await breakfastOption.click();
  await expect(shown(page, t.swappedNotEaten(name))).toBeVisible();
});

test('"See more" lists up to 8 options that all fit the meal, with a search box', async ({ page }) => {
  await today(page);
  await button(page, t.seeMore).filter({ visible: true }).first().click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  const items = sheet.getByRole('button').filter({ hasText: /^Use / });
  const n = await items.count();
  expect(n).toBeGreaterThanOrEqual(3);
  expect(n).toBeLessThanOrEqual(8);
  // Every one is a breakfast recipe (this is the first meal), nothing else.
  for (const label of await items.allTextContents()) expect(label).toMatch(/Greek yogurt bowl|Eggs on toast|Protein pancakes/);
  await sheet.getByLabel(t.searchRecipes).fill('pancakes');
  await expect(items).toHaveCount(1);
  await sheet.getByLabel(t.searchRecipes).fill('zzzz');
  await expect(sheet.getByText(t.noOptionsFound)).toBeVisible();
});


test('Nutrition offers the same slot-fitting choices through "Swap meal" and records the swap', async ({ page }) => {
  const backend = await signedInWithPlan(page);
  await page.goto('/nutrition');
  await button(page, en.nutrition.swapMeal).filter({ visible: true }).first().click();
  const sheet = page.getByRole('dialog');
  const picks = sheet.getByRole('button').filter({ hasText: /^Use / });
  await expect(picks.first()).toBeVisible();
  for (const label of await picks.allTextContents()) expect(label).toMatch(/Greek yogurt bowl|Eggs on toast|Protein pancakes/);
  await picks.first().click();
  await expect.poll(() => backend.state.mealSwaps.length).toBe(1);
});

test('no number is split from its unit (kcal, g, min) and three cards share the row evenly', async ({ page }) => {
  await today(page);
  // Every "540 kcal", "38 g protein" and "15 min" is joined by non-breaking spaces.
  const lines = await page.getByText(/\d+\u00A0kcal/).filter({ visible: true }).allTextContents();
  expect(lines.length).toBeGreaterThan(0);
  for (const line of lines) {
    expect(line).not.toMatch(/\d [a-z]/); // a number followed by a normal space and its unit
    expect(line).toMatch(/\d+\u00A0g\u00A0protein/);
  }
  // Wide layouts: the option cards in a meal are as wide as each other and share one row.
  const vp = page.viewportSize()!;
  if (vp.width >= 600) {
    const boxes = await optionCards(page).evaluateAll((els) => els.slice(0, 3).map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: Math.round(r.y), w: Math.round(r.width) }; }));
    expect(new Set(boxes.map((b) => b.y)).size).toBe(1);
    expect(Math.max(...boxes.map((b) => b.w)) - Math.min(...boxes.map((b) => b.w))).toBeLessThanOrEqual(2);
  }
});

// #183: the meals column is much narrower than the screen between 600 and about 1000 px, so the cards must not be squeezed
// into equal columns there. These tests set their own widths, so they run once (in the desktop project).
test.describe('option cards and the See more sheet at every width', () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'sets its own widths; runs once, in the desktop project'));

  /** Figures ("540 kcal", "38 g protein", "15 min", joined by non-breaking spaces) whose text is drawn over more than one line. */
  const wrappedFigures = (page: import('@playwright/test').Page, belowY = -Infinity) =>
    page.evaluate((minTop) => {
      const re = /\d+(?:\.\d+)?\u00A0(?:g\u00A0protein|kcal|min|g)/g;
      const found: { all: number; wrapped: string[] } = { all: 0, wrapped: [] };
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (!parent || parent.getClientRects().length === 0) continue; // on a screen that is not shown
        for (const m of (node.textContent ?? '').matchAll(re)) {
          const range = document.createRange();
          range.setStart(node, m.index!);
          range.setEnd(node, m.index! + m[0].length);
          const lines = new Set(Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.top >= minTop).map((r) => Math.round(r.top)));
          if (lines.size === 0) continue; // not drawn, or above the area being checked
          found.all++;
          if (lines.size > 1) found.wrapped.push(m[0].replace(/\u00A0/g, ' '));
        }
      }
      return found;
    }, belowY);

  for (const [width, height] of [[390, 844], [340, 740], [600, 900], [820, 1180], [1024, 800], [1440, 900]] as const) {
    test(`at ${width} px every option card is at least 150 px wide and no figure is split`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await today(page);
      const cards = optionCards(page);
      await expect.poll(() => cards.count()).toBeGreaterThanOrEqual(2);
      const boxes = await cards.evaluateAll((els) => els.slice(0, 3).map((e) => { const r = e.getBoundingClientRect(); return { y: Math.round(r.y), w: Math.round(r.width) }; }));
      for (const b of boxes) expect(b.w, `card widths at ${width} px: ${boxes.map((x) => x.w).join(', ')}`).toBeGreaterThanOrEqual(150);
      // Three cards on one row are equally wide (equal columns, or the same fixed width when the row scrolls).
      if (new Set(boxes.map((b) => b.y)).size === 1) expect(Math.max(...boxes.map((b) => b.w)) - Math.min(...boxes.map((b) => b.w))).toBeLessThanOrEqual(2);
      const figures = await wrappedFigures(page);
      expect(figures.all, 'figures found on the page').toBeGreaterThan(0);
      expect(figures.wrapped, `figures drawn over more than one line at ${width} px`).toEqual([]);
    });
  }

  for (const [name, width, height] of [['phone', 390, 844], ['tablet', 820, 1180], ['desktop', 1440, 900]] as const) {
    test(`the See more sheet at ${name} width (${width} px): rows are tappable and no figure is split`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await today(page);
      await button(page, t.seeMore).filter({ visible: true }).first().click();
      const title = page.getByText(t.optionsFor('Breakfast'), { exact: true }).filter({ visible: true }).first();
      await expect(title).toBeVisible();
      // The sheet's own rows (they are the buttons that sit below its title).
      const titleBox = (await title.boundingBox())!;
      const rows = optionCards(page).filter({ has: page.locator('div') });
      const sheetRows = await rows.evaluateAll((els, top) => els.map((e) => { const r = e.getBoundingClientRect(); return { y: r.y, h: Math.round(r.height), w: Math.round(r.width) }; }).filter((r) => r.y > (top as number)), titleBox.y);
      expect(sheetRows.length, 'rows in the sheet').toBeGreaterThanOrEqual(3);
      for (const r of sheetRows) expect(r.h).toBeGreaterThanOrEqual(48);
      // Only what is drawn below the sheet's title: the sheet alone, not the cards behind it.
      const figures = await wrappedFigures(page, titleBox.y);
      expect(figures.all, 'figures in the sheet').toBeGreaterThanOrEqual(3);
      expect(figures.wrapped, `figures drawn over more than one line in the sheet at ${name} width`).toEqual([]);
    });
  }
});
