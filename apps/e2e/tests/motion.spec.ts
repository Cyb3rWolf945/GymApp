import { expect, test, type Page } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { button, chip, shown, signedInWithPlan, start } from '../support/app';
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

test('switching tabs cross-fades the new screen in', async ({ page }) => {
  await signedInWithPlan(page, { fixedTime: false });
  await expect(shown(page, en.home.title)).toBeVisible();
  const seen = lowestOpacity(page, en.home.planTitle, 700);
  await page.getByRole('tab', { name: en.home.tabs.plan, exact: true }).click();
  const { min, final } = await seen;
  expect(min, 'the Plan screen faded in').toBeLessThan(0.9);
  expect(final).toBe(1);
});

/** The scale of the element as the browser draws it (1 = no transform). */
const scaleOf = (page: Page, label: string) =>
  page.evaluate((name) => {
    const el = Array.from(document.querySelectorAll('[role="button"]')).find((b) => b.getAttribute('aria-label') === name);
    const m = el ? getComputedStyle(el).transform.match(/matrix\(([^,]+),/) : null;
    return m ? Number(m[1]) : 1;
  }, label);

test('a pressed button springs in, and springs back when let go', async ({ page }) => {
  await atGoalStep(page);
  await chip(page, o.goal.options.recomp).click();
  const target = button(page, en.common.continue);
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(() => scaleOf(page, en.common.continue), 'shrinks while pressed').toBeLessThan(0.99);
  expect(await scaleOf(page, en.common.continue)).toBeGreaterThan(0.9); // a touch, not a collapse
  await page.mouse.move(box.x + box.width / 2, box.y - 40); // slide off so releasing does not press it
  await page.mouse.up();
  await expect.poll(() => scaleOf(page, en.common.continue), 'springs back').toBeGreaterThan(0.999);
});

/** A list row (a ListItem): its layout and its press scale, read from the element inside the press target. */
async function pressRow(page: Page, name: RegExp) {
  const row = page.getByRole('button', { name }).filter({ visible: true }).first();
  await row.waitFor();
  const layout = await row.evaluate((el) => {
    const inner = el.firstElementChild as HTMLElement;
    const cs = getComputedStyle(inner);
    return { height: inner.getBoundingClientRect().height, direction: cs.flexDirection, border: cs.borderBottomWidth };
  });
  const scale = () =>
    row.evaluate((el) => {
      const m = getComputedStyle(el.firstElementChild as HTMLElement).transform.match(/matrix\(([^,]+),/);
      return m ? Number(m[1]) : 1;
    });
  const box = (await row.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  return { layout, scale, release: async () => { await page.mouse.move(box.x + box.width / 2, box.y - 80); await page.mouse.up(); } };
}

test('a list row keeps its layout and springs in a touch when pressed', async ({ page }) => {
  await signedInWithPlan(page, { fixedTime: false });
  await page.goto('/plan'); // lists every exercise of the plan, whatever day it is
  await expect(shown(page, en.home.planTitle)).toBeVisible();
  const r = await pressRow(page, /Barbell bench press/);
  expect(r.layout.height, 'min height of a row').toBeGreaterThanOrEqual(56);
  expect(r.layout.direction).toBe('row');
  expect(r.layout.border).toBe('1px');
  await expect.poll(r.scale, 'shrinks while pressed').toBeLessThan(0.999);
  expect(await r.scale()).toBeGreaterThan(0.95); // a touch, not a collapse
  await r.release();
  await expect.poll(r.scale, 'springs back').toBeGreaterThan(0.999);
});

test('the plan reveal celebrates once, with confetti that never blocks taps', async ({ page }) => {
  await signedInWithPlan(page, { fixedTime: false });
  await page.goto('/preview');
  const burst = page.getByTestId('celebration');
  await expect(burst).toHaveCount(1);
  await expect(burst).toHaveCSS('pointer-events', 'none');
  await expect(page.getByText(en.plan.preview.title, { exact: true })).toBeVisible();
});

test.describe('reduced motion', () => {
  test('the plan reveal has no confetti', async ({ page }) => {
    await signedInWithPlan(page);
    await page.goto('/preview');
    await expect(page.getByText(en.plan.preview.title, { exact: true })).toBeVisible();
    await expect(page.getByTestId('celebration')).toHaveCount(0);
  });

  test.use({ reducedMotion: 'reduce' });

  test('a pressed button does not move, and switching tabs does not fade', async ({ page }) => {
    await atGoalStep(page);
    await chip(page, o.goal.options.recomp).click();
    const box = (await button(page, en.common.continue).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(300);
    expect(await scaleOf(page, en.common.continue)).toBe(1);
    await page.mouse.move(box.x + box.width / 2, box.y - 40);
    await page.mouse.up();
  });

  test('a list row keeps its layout and does not move when pressed', async ({ page }) => {
    await signedInWithPlan(page);
    await page.goto('/plan');
    await expect(shown(page, en.home.planTitle)).toBeVisible();
    const r = await pressRow(page, /Barbell bench press/);
    expect(r.layout.height).toBeGreaterThanOrEqual(56);
    expect(r.layout.direction).toBe('row');
    await page.waitForTimeout(300);
    expect(await r.scale()).toBe(1);
    await r.release();
  });

  test('switching tabs shows the new screen at once', async ({ page }) => {
    await signedInWithPlan(page);
    await expect(shown(page, en.home.title)).toBeVisible();
    const seen = lowestOpacity(page, en.home.planTitle, 500);
    await page.getByRole('tab', { name: en.home.tabs.plan, exact: true }).click();
    const { min } = await seen;
    expect(min, 'no fade').toBeGreaterThan(0.99);
  });

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
