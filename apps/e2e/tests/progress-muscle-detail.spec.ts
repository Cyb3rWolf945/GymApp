import { expect, test, type Page } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { button, chip, signedInWithPlan } from '../support/app';

// E-75: the muscle detail sheet on Progress. Phone and desktop (a bottom sheet, and a centred dialog).
const p = en.home.progress;
const d = p.detail;

// Playwright insists on the destructuring pattern for the first argument, even when no fixture is used.
// eslint-disable-next-line no-empty-pattern
test.beforeEach(({}, info) => test.skip(info.project.name === 'tablet', 'phone and desktop only'));

async function progress(page: Page) {
  const backend = await signedInWithPlan(page, { fixedTime: false });
  backend.state.history = new Date();
  await page.goto('/progress');
  await expect(page.getByText(p.weightTitle, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  return backend;
}

/** Tap a muscle on the map (its shape is named "Quadriceps, 3 sets this week"). */
async function tapMuscle(page: Page, name: string) {
  const shape = page.getByLabel(new RegExp(`^${name}, `)).filter({ visible: true }).first();
  await shape.scrollIntoViewIfNeeded();
  await shape.click();
}

const sheet = (page: Page, name: string) => page.getByRole('dialog', { name });

test('tapping Quadriceps opens the sheet: heat level, tiles, 8-week chart, top exercises, train it next, about', async ({ page }) => {
  await progress(page);
  await tapMuscle(page, 'Quadriceps');
  const dialog = sheet(page, 'Quadriceps');
  await expect(dialog).toBeVisible();

  // Header: the muscle on a body, and its heat level in the map legend's words.
  await expect(dialog.getByTestId('muscle-thumbnail')).toHaveAttribute('aria-label', d.thumbnail('Quadriceps'));
  const chipText = await dialog.getByTestId('heat-chip').innerText();
  expect(chipText).toMatch(new RegExp(`^(${p.heatNames.join('|')}) · .+ sets$`));
  await expect(dialog.getByTestId('heat-chip')).toHaveAttribute('aria-label', /^Heat level: .+ sets a week$/);

  // Tiles: sets, last trained (relative), status (general guidance).
  await expect(dialog.getByText(d.setsWeek, { exact: true })).toBeVisible();
  await expect(dialog.getByText(d.last, { exact: true })).toBeVisible();
  await expect(dialog.getByText(d.status, { exact: true })).toBeVisible();
  // The fixture trains it "4 days ago" counted back from the current time (minus an hour), so between 00:00 and 01:00 UTC the calendar count is 5.
  await expect(dialog.getByText(new RegExp(`^(${d.daysAgo(4)}|${d.daysAgo(5)})$`))).toBeVisible();
  await expect(dialog.getByText(d.statusNames.ready, { exact: true })).toBeVisible();
  await expect(dialog.getByText(d.statusNote, { exact: false })).toBeVisible();

  // The weekly chart: a text alternative, a reference band, the guideline in words.
  await expect(dialog.getByRole('img', { name: /^Bar chart of sets per week over the last 8 weeks, oldest first: .+\. Reference band: 10–20 sets a week\.$/ })).toBeVisible();
  await expect(dialog.getByTestId('bar-band')).toHaveCount(1);
  await expect(dialog.getByText(d.guideline, { exact: false })).toBeVisible();

  // Top exercises with their role and share; the exercises you could do next that suit your equipment and level.
  await expect(dialog.getByTestId('top-exercise').first()).toContainText('Barbell back squat');
  await expect(dialog.getByTestId('top-exercise').first()).toContainText(`${d.primary} · ${d.share(100)}`);
  await expect(dialog.getByTestId('train-next').filter({ hasText: 'Goblet squat' })).toBeVisible();
  await expect(dialog.getByTestId('train-next').filter({ hasText: 'Bodyweight squat' })).toBeVisible();
  await expect(dialog.getByText('Bulgarian split squat')).toHaveCount(0); // advanced: above a beginner's level

  // About this muscle.
  await expect(dialog.getByTestId('muscle-about')).toHaveText(`Quadriceps: ${p.muscles.quadriceps.plain}. ${p.muscles.quadriceps.about}`);
});

test('the sheet is a bottom sheet on a phone and a dialog of about 480 px on desktop', async ({ page }) => {
  await progress(page);
  await tapMuscle(page, 'Quadriceps');
  const box = (await sheet(page, 'Quadriceps').boundingBox())!;
  const vp = page.viewportSize()!;
  if (vp.width < 600) {
    expect(box.width, 'a phone sheet spans the screen').toBeGreaterThanOrEqual(vp.width - 2);
    expect(box.y + box.height, 'and sits at the bottom').toBeGreaterThanOrEqual(vp.height - 2);
  } else {
    expect(box.width).toBeLessThanOrEqual(481);
    expect(box.width).toBeGreaterThanOrEqual(400);
    expect(Math.abs(box.x + box.width / 2 - vp.width / 2), 'centred').toBeLessThan(20);
  }
});

test('the arrows step to the next and previous muscle, the sheet follows and the arrows say where they go', async ({ page }) => {
  await progress(page);
  await tapMuscle(page, 'Quadriceps');
  const dialog = sheet(page, 'Quadriceps');
  const next = dialog.getByTestId('muscle-next');
  await expect(next).toHaveAttribute('aria-label', /^Next muscle: .+/);
  const nextName = (await next.getAttribute('aria-label'))!.replace('Next muscle: ', '');
  const prevName = ((await dialog.getByTestId('muscle-prev').getAttribute('aria-label')) ?? '').replace('Previous muscle: ', '');
  expect(nextName).not.toBe('Quadriceps');
  expect(prevName).not.toBe('Quadriceps');
  await next.click();
  await expect(sheet(page, nextName)).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Quadriceps' })).toHaveCount(0);
  // About text follows the muscle, and the way back leads home.
  await expect(sheet(page, nextName).getByTestId('muscle-about')).toContainText(`${nextName}:`);
  await sheet(page, nextName).getByTestId('muscle-prev').click();
  await expect(sheet(page, 'Quadriceps')).toBeVisible();
});

test('tapping a top exercise or a suggestion opens its detail', async ({ page }) => {
  await progress(page);
  await tapMuscle(page, 'Quadriceps');
  await sheet(page, 'Quadriceps').getByTestId('top-exercise').getByRole('button', { name: /Barbell back squat/ }).first().click();
  await expect(page).toHaveURL(/\/exercise\/barbell-back-squat/);
  await page.goBack();
  await expect(page.getByText(p.weightTitle, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await tapMuscle(page, 'Quadriceps');
  await sheet(page, 'Quadriceps').getByTestId('train-next').getByRole('button', { name: /Goblet squat/ }).click();
  await expect(page).toHaveURL(/\/exercise\/goblet-squat/);
});

test('an untrained muscle gets an encouraging line and suggestions, not an empty chart', async ({ page }) => {
  await progress(page);
  await tapMuscle(page, 'Rectus abdominis');
  const dialog = sheet(page, 'Rectus abdominis');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('muscle-empty')).toHaveText(d.empty);
  await expect(dialog.getByTestId('heat-chip')).toContainText(`${p.heatNames[0]} · 0 sets`);
  await expect(dialog.getByTestId('bar-chart')).toHaveCount(0);
  await expect(dialog.getByTestId('train-next').filter({ hasText: 'Plank' })).toBeVisible();
  await expect(dialog.getByTestId('train-next').filter({ hasText: 'Dead bug' })).toBeVisible();
  await expect(dialog.getByText('Cable crunch')).toHaveCount(0); // intermediate
  // No guilt: nothing says "missed", "behind" or "should have".
  await expect(dialog).not.toContainText(/missed|behind|should have|lazy/i);
});

test('the 30-day switch makes the tile a weekly average', async ({ page }) => {
  await progress(page);
  await chip(page, p.period30).click();
  await tapMuscle(page, 'Quadriceps');
  await expect(sheet(page, 'Quadriceps').getByText(d.setsWeek30, { exact: true })).toBeVisible();
});

test('closing the sheet leaves the map as it was', async ({ page }) => {
  await progress(page);
  await tapMuscle(page, 'Quadriceps');
  await expect(sheet(page, 'Quadriceps')).toBeVisible();
  // The dimmed area behind the sheet is the close button: click its corner (its middle is under the sheet).
  await button(page, en.common.close).first().click({ position: { x: 4, y: 4 } });
  await expect(page.getByRole('dialog', { name: 'Quadriceps' })).toHaveCount(0);
  await expect(page.getByText(p.weightTitle, { exact: true }).filter({ visible: true }).first()).toBeVisible();
});

test('a muscle drawn on both sides stays on the Back map, and the arrows step through the back muscles and return', async ({ page }) => {
  await progress(page);
  await chip(page, p.back).filter({ visible: true }).first().click();
  await page.waitForTimeout(600);
  // Rhomboids' tap area covers the middle of Trapezius: click near the top of its shape (the neck).
  const trap = page.getByLabel(/^Trapezius, /).filter({ visible: true }).first();
  const box = (await trap.boundingBox())!;
  await trap.click({ position: { x: box.width / 2, y: box.height * 0.1 } });
  const dialog = sheet(page, 'Trapezius');
  await expect(dialog).toBeVisible();
  // The map is still the back view, and the thumbnail is too.
  await expect(page.locator('svg[aria-label="Muscle map, back view"]').filter({ visible: true }).first()).toBeVisible();
  await expect(page.locator('svg[aria-label="Muscle map, front view"]').filter({ visible: true })).toHaveCount(0);
  const nextName = ((await dialog.getByTestId('muscle-next').getAttribute('aria-label')) ?? '').replace('Next muscle: ', '');
  await dialog.getByTestId('muscle-next').click();
  await expect(sheet(page, nextName)).toBeVisible();
  await expect(page.locator('svg[aria-label="Muscle map, front view"]').filter({ visible: true })).toHaveCount(0);
  await sheet(page, nextName).getByTestId('muscle-prev').click();
  await expect(sheet(page, 'Trapezius')).toBeVisible();
});

test('the words in the three tiles stay inside their tile at 340 and 390 px, for a muscle trained yesterday', async ({ page }) => {
  for (const width of [340, 390]) {
    await page.setViewportSize({ width, height: 800 });
    for (const muscle of ['Trapezius', 'Deltoid anterior', 'Pectoralis major', 'Triceps brachii']) {
      await progress(page); // a fresh Progress each time: the previous sheet is gone
      if (muscle === 'Trapezius' || muscle === 'Pectoralis major' || muscle === 'Deltoid anterior') await chip(page, p.front).filter({ visible: true }).first().click();
      else await chip(page, p.back).filter({ visible: true }).first().click();
      await tapMuscle(page, muscle);
      const dialog = sheet(page, muscle);
      await expect(dialog).toBeVisible();
      // Every text in a tile ends before its tile's edge (the status word used to stick out: "Recoverin").
      const overflow = await dialog.evaluate((root) => {
        const out: string[] = [];
        for (const tile of Array.from(root.querySelectorAll('[aria-label]')).filter((e) => /^(Sets this week|Last trained|Status)/.test(e.getAttribute('aria-label') ?? ''))) {
          const box = tile.getBoundingClientRect();
          for (const el of Array.from(tile.querySelectorAll('*'))) {
            if (!el.children.length && (el.textContent ?? '').trim()) {
              const r = document.createRange();
              r.selectNodeContents(el);
              const t = r.getBoundingClientRect();
              if (t.right > box.right - 1 || t.left < box.left) out.push(`${(el.textContent ?? '').trim()} (+${Math.round(t.right - box.right)} px)`);
            }
          }
        }
        return out;
      });
      expect(overflow, `${width} px, ${muscle}`).toEqual([]);
    }
  }
});
