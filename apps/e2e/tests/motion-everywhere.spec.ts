import { expect, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { shown, signedInWithPlan } from '../support/app';

// E-63. Everything else runs with reduced motion. This file runs WITHOUT it (and with a ticking clock, which JS animations
// need), to prove the animations never leave a screen stuck, blank or half-faded.
test.use({ reducedMotion: 'no-preference' });

const tab = (page: import('@playwright/test').Page, name: string) => page.getByRole('tab', { name, exact: true });

test('with animations on: sign in, Today, Plan, Progress and the plan preview all finish and show their content', async ({ page }) => {
  await signedInWithPlan(page, { fixedTime: false });

  // Today: the greeting, the workout card and the meals card arrive.
  await expect(shown(page, en.home.title)).toBeVisible();
  await expect(shown(page, en.home.startWorkout)).toBeVisible();
  await expect(shown(page, en.home.mealsTitle)).toBeVisible();
  // The numbers count up and land on their final value.
  await expect(shown(page, en.plan.preview.kcal)).toBeVisible();

  // Plan: the day cards reveal.
  await tab(page, en.home.tabs.plan).click();
  await expect(shown(page, en.home.planTitle)).toBeVisible();
  await expect(shown(page, 'Barbell bench press', false)).toBeVisible();

  // Progress: the charts and the muscle map draw, the screen is usable.
  await tab(page, en.home.tabs.progress).click();
  await expect(shown(page, en.home.tabs.progress)).toBeVisible();
  await expect(page.getByText(en.home.progress.weightTitle, { exact: true }).filter({ visible: true }).first()).toBeVisible();

  // Back to Today: a later visit is just the quick cross-fade, and the content is fully there.
  await tab(page, en.home.tabs.today).click();
  await expect(shown(page, en.home.startWorkout)).toBeVisible();
  // The lowest opacity of the button and its parents. A read right after "visible" can land on the first frame of the tab's
  // cross-fade (opacity 0) when the screen mounts slowly, so wait for the screen to settle: it must reach 1, never stay at 0.
  const lowestOpacity = () =>
    shown(page, en.home.startWorkout).evaluate((el) => {
      let node: HTMLElement | null = el as HTMLElement;
      let min = 1;
      while (node) {
        min = Math.min(min, Number(getComputedStyle(node).opacity));
        node = node.parentElement;
      }
      return min;
    });
  await expect.poll(lowestOpacity, { timeout: 5_000 }).toBe(1);

  // The plan preview: the title, the cards and the counted-up numbers.
  await page.goto('/preview');
  await expect(shown(page, en.plan.preview.title)).toBeVisible();
  await expect(shown(page, en.plan.preview.mealsTitle)).toBeVisible();
});

test('the muscle map fills in and the line chart draws to the end', async ({ page }) => {
  const backend = await signedInWithPlan(page, { fixedTime: false });
  backend.state.history = new Date();
  await page.goto('/progress');
  await expect(page.getByText(en.home.progress.weightTitle, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  // After the draw the chart's line shows all of it (dash offset 0) and the map's regions have their final fill.
  await expect.poll(
    () =>
      page.evaluate(() => {
        const lines = Array.from(document.querySelectorAll('path[stroke-dasharray]'));
        return lines.length > 0 && lines.every((p) => Number(p.getAttribute('stroke-dashoffset')) === 0);
      }),
    { timeout: 8_000 },
  ).toBe(true);
});
