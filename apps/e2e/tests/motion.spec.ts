import { expect, test, type Page } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { button, chip, start } from '../support/app';
import { ownViewports } from '../support/projects';

// The one place animation is on: every other spec runs with reduced motion (playwright.config.ts) so nothing is
// caught mid-transition. Here the OS setting is "no preference".
ownViewports();
test.use({ reducedMotion: 'no-preference' });

const o = en.onboarding.steps;

async function atGoalStep(page: Page) {
  const backend = await start(page, { fixedTime: false });
  await page.goto('/onboarding/goal');
  await button(page, en.tracking.reject).click();
  await expect(chip(page, o.goal.options.recomp)).toBeVisible();
  return backend;
}

/** The lowest opacity the element (and its parents) had over the next `ms`: below 1 means it was animating in. */
const lowestOpacity = (page: Page, text: string, ms = 700) =>
  page.evaluate(
    ([t, span]) =>
      new Promise<{ min: number; final: number; moved: boolean }>((resolve) => {
        const started = performance.now();
        let min = 1;
        let moved = false;
        const effective = (el: Element | null) => {
          let o = 1;
          for (let n: Element | null = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
          return o;
        };
        const tick = () => {
          const el = Array.from(document.querySelectorAll('div')).find((d) => d.children.length === 0 && d.textContent === t) ?? null;
          if (el) {
            min = Math.min(min, effective(el));
            for (let n: Element | null = el; n; n = n.parentElement) {
              const tr = getComputedStyle(n).transform;
              if (tr && tr !== 'none' && !/matrix\(1, 0, 0, 1, 0, 0\)/.test(tr)) moved = true;
            }
          }
          if (performance.now() - started < (span as number)) requestAnimationFrame(tick);
          else resolve({ min, final: effective(el), moved });
        };
        requestAnimationFrame(tick);
      }),
    [text, ms] as const,
  );

test('a step fades and slides in, and settles fully visible', async ({ page }) => {
  await atGoalStep(page);
  await chip(page, o.goal.options.recomp).click();
  const seen = lowestOpacity(page, o.basics.title);
  await button(page, en.common.continue).click();
  const { min, final, moved } = await seen;
  expect(min, 'the title started faded').toBeLessThan(0.9);
  expect(moved, 'and travelled sideways').toBe(true);
  expect(final, 'and ended fully visible').toBe(1);
});

test('going back enters from the other side', async ({ page }) => {
  await atGoalStep(page);
  await chip(page, o.goal.options.recomp).click();
  await button(page, en.common.continue).click();
  await expect(page.getByText(o.basics.title, { exact: true }).first()).toBeVisible();
  const seen = lowestOpacity(page, o.goal.title);
  await button(page, en.common.back).click();
  const { final } = await seen;
  expect(final).toBe(1);
  await expect(page).toHaveURL(/\/onboarding\/goal/);
});

test('a double tap on Continue moves one step, once', async ({ page }) => {
  const backend = await atGoalStep(page);
  await chip(page, o.goal.options.recomp).click();
  await button(page, en.common.continue).dblclick();
  await expect(page).toHaveURL(/\/onboarding\/basics/);
  await page.waitForTimeout(600);
  await expect(page).toHaveURL(/\/onboarding\/basics/); // not two steps on
  const completed = backend.writesTo('/track-event').filter((w) => (w.body as { name?: string })?.name === 'onboarding_step_completed');
  expect(completed).toHaveLength(1);
});

test('Continue with nothing chosen shakes and the message fades in; the step stays', async ({ page }) => {
  await atGoalStep(page);
  const seen = lowestOpacity(page, en.onboarding.fieldErrors.goalType.missing, 600);
  await button(page, en.common.continue).click();
  await expect(page.getByRole('alert').filter({ hasText: en.onboarding.fieldErrors.goalType.missing })).toBeVisible();
  const { min, final } = await seen;
  expect(min, 'the message faded in').toBeLessThan(0.9);
  expect(final).toBe(1);
  await expect(page).toHaveURL(/\/onboarding\/goal/);
  // Choosing something clears the way: Continue now moves on.
  await chip(page, o.goal.options.recomp).click();
  await button(page, en.common.continue).click();
  await expect(page).toHaveURL(/\/onboarding\/basics/);
});

test('the progress bar moves to the new step', async ({ page }) => {
  await atGoalStep(page);
  const bar = page.getByRole('progressbar').first();
  const before = Number(await bar.getAttribute('aria-valuenow'));
  await chip(page, o.goal.options.recomp).click();
  await button(page, en.common.continue).click();
  await expect.poll(async () => Number(await bar.getAttribute('aria-valuenow'))).toBe(before + 1);
});

test('a chosen chip shows a check', async ({ page }) => {
  await atGoalStep(page);
  const c = chip(page, o.goal.options.recomp);
  await expect(c).not.toContainText('✓');
  await c.click();
  await expect(c).toContainText('✓');
  await expect(c).toHaveAttribute('aria-checked', 'true');
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('nothing animates: content is fully visible at once, even with the clock frozen', async ({ page }) => {
    await start(page); // frozen clock: any animation would stay stuck at its first frame
    await page.goto('/onboarding/goal');
    await button(page, en.tracking.reject).click();
    await chip(page, o.goal.options.recomp).click();
    // Playwright counts opacity 0 as visible, so check the real, combined opacity of the title, a chip and the progress bar.
    const opacity = (text: string) =>
      page.evaluate((t) => {
        const el = Array.from(document.querySelectorAll('div')).find((d) => d.children.length === 0 && d.textContent === t) ?? null;
        let value = 1;
        for (let n: Element | null = el; n; n = n.parentElement) value *= Number(getComputedStyle(n).opacity);
        return el ? value : -1;
      }, text);
    expect(await opacity(o.goal.title)).toBe(1);
    expect(await opacity(o.goal.options.recomp)).toBe(1);
    // The chip is already in its chosen colours (no fade between states).
    const bg = await chip(page, o.goal.options.recomp).locator('div').first().evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(bg).toBe('rgb(198, 255, 61)');
    await button(page, en.common.continue).click();
    await expect(page).toHaveURL(/\/onboarding\/basics/); // no pulse delay, no slide
    expect(await opacity(o.basics.title)).toBe(1);
  });
});
